package com.example.mockmate.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SupabaseJwtVerifier {

    @Value("${supabase.jwks-url:https://sslnbmgjgxcztqtzeonj.supabase.co/auth/v1/.well-known/jwks.json}")
    private String jwksUrl;

    // Without an explicit timeout, Java's default HTTP client has NO bound on
    // connect/read time — a slow or hung Supabase call blocks the login
    // request indefinitely instead of failing fast. This is what "taking too
    // much time and then erroring" was: a multi-minute hang, not a fast error.
    private final RestTemplate restTemplate = buildRestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, PublicKey> keyCache = new ConcurrentHashMap<>();

    private static RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());
        return new RestTemplate(factory);
    }

    public Claims verifyAndGetClaims(String token) {
        try {
            String kid = getKidFromHeader(token);
            if (kid == null) {
                throw new IllegalArgumentException("JWT header missing 'kid'");
            }

            PublicKey publicKey = keyCache.get(kid);
            if (publicKey == null) {
                // One network round-trip populates every key from the JWKS
                // response, not just the one we're after — a genuinely
                // rotated key (Supabase added a new one) is now caught by
                // the SAME fetch that would previously have needed a second,
                // cache-clearing round-trip.
                fetchAllPublicKeys();
                publicKey = keyCache.get(kid);
            }

            if (publicKey == null) {
                throw new IllegalStateException("Failed to retrieve matching public key for kid: " + kid);
            }

            return Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Supabase JWT token: " + e.getMessage(), e);
        }
    }

    private String getKidFromHeader(String token) {
        try {
            int firstDot = token.indexOf('.');
            String headerJson = new String(Decoders.BASE64URL.decode(token.substring(0, firstDot)));
            JsonNode node = objectMapper.readTree(headerJson);
            return node.path("kid").asText(null);
        } catch (Exception e) {
            return null;
        }
    }

    /** Populates {@link #keyCache} with every key in one JWKS round-trip,
     *  rather than fetching (and on miss, re-fetching) per individual kid. */
    private void fetchAllPublicKeys() {
        try {
            String jwksJson = restTemplate.getForObject(jwksUrl, String.class);
            JsonNode root = objectMapper.readTree(jwksJson);
            for (JsonNode keyNode : root.path("keys")) {
                String kid = keyNode.path("kid").asText(null);
                if (kid == null) continue;
                try {
                    keyCache.put(kid, parseKey(keyNode));
                } catch (Exception ex) {
                    System.err.println("Error parsing Supabase public key kid=" + kid + ": " + ex.getMessage());
                }
            }
        } catch (Exception ex) {
            System.err.println("Error fetching Supabase public keys: " + ex.getMessage());
        }
    }

    private PublicKey parseKey(JsonNode keyNode) throws Exception {
        String kty = keyNode.path("kty").asText();
        if ("EC".equals(kty)) {
            String x = keyNode.path("x").asText();
            String y = keyNode.path("y").asText();
            BigInteger xCoord = new BigInteger(1, Decoders.BASE64URL.decode(x));
            BigInteger yCoord = new BigInteger(1, Decoders.BASE64URL.decode(y));
            java.security.spec.ECPoint point = new java.security.spec.ECPoint(xCoord, yCoord);

            java.security.AlgorithmParameters params = java.security.AlgorithmParameters.getInstance("EC");
            params.init(new java.security.spec.ECGenParameterSpec("secp256r1"));
            java.security.spec.ECParameterSpec ecParameters = params.getParameterSpec(java.security.spec.ECParameterSpec.class);

            java.security.spec.ECPublicKeySpec spec = new java.security.spec.ECPublicKeySpec(point, ecParameters);
            KeyFactory factory = KeyFactory.getInstance("EC");
            return factory.generatePublic(spec);
        } else {
            String n = keyNode.path("n").asText();
            String e = keyNode.path("e").asText();
            BigInteger modulus = new BigInteger(1, Decoders.BASE64URL.decode(n));
            BigInteger exponent = new BigInteger(1, Decoders.BASE64URL.decode(e));
            RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
            KeyFactory factory = KeyFactory.getInstance("RSA");
            return factory.generatePublic(spec);
        }
    }
}
