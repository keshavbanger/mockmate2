import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ListModels {
    public static void main(String[] args) throws Exception {
        String key = "AIzaSyAAJvlPvLZlz6GKH29hIFbwQeq2u5dpBFk";
        String url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + key;
        
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();
        
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
