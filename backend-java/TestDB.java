import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class TestDB {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://db.sslnbmgjgxcztqtzeonj.supabase.co:6543/postgres?user=postgres.sslnbmgjgxcztqtzeonj&password=Kashu2006Kashu&sslmode=require";
        try {
            Connection conn = DriverManager.getConnection(url);
            System.out.println("Connected successfully!");
            conn.close();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
