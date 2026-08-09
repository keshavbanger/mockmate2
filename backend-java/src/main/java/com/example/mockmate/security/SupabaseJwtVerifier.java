package com.example.mockmate.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SupabaseJwtVerifier {

    @Value("${supabase.jwks-url:https://sslnbmgjgxcztqtzeonj.supabase.co/auth/v1/.well-known/jwks.json}")
    private String jwksUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, PublicKey> keyCache = new ConcurrentHashMap<>();

    public Claims verifyAndGetClaims(String token) {
        try {
            String kid = getKidFromHeader(token);
            if (kid == null) {
                throw new IllegalArgumentException("JWT header missing 'kid'");
            }

            PublicKey publicKey = keyCache.computeIfAbsent(kid, this::fetchPublicKey);
            if (publicKey == null) {
                keyCache.clear();
                publicKey = keyCache.computeIfAbsent(kid, this::fetchPublicKey);
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

    private PublicKey fetchPublicKey(String kid) {
        try {
            String jwksJson = restTemplate.getForObject(jwksUrl, String.class);
            JsonNode root = objectMapper.readTree(jwksJson);
            JsonNode keysNode = root.path("keys");
            for (JsonNode keyNode : keysNode) {
                if (kid.equals(keyNode.path("kid").asText())) {
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
        } catch (Exception ex) {
            System.err.println("Error fetching Supabase public keys: " + ex.getMessage());
        }
        return null;
    }
}
