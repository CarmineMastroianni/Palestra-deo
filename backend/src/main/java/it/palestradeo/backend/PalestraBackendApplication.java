package it.palestradeo.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Backend OPZIONALE per "My Fitness & Futsal".
 * Fornisce solo: (1) storage di backup cifrati lato client, (2) proxy verso l'API di Claude.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class PalestraBackendApplication {
    public static final String VERSION = "1.0.0";

    public static void main(String[] args) {
        SpringApplication.run(PalestraBackendApplication.class, args);
    }
}
