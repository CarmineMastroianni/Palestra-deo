package it.palestradeo.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue("") String token,
        @DefaultValue("*") String allowedOrigins,
        @DefaultValue("150") int maxUploadMb,
        @DefaultValue Backup backup,
        @DefaultValue Ai ai) {

    public record Backup(@DefaultValue("10") int maxVersions) {}

    public record Ai(
            @DefaultValue("") String apiKey,
            @DefaultValue("claude-opus-5-5") String model,
            @DefaultValue("4000") long maxTokens,
            @DefaultValue("200000") int maxInputChars) {

        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }

        @Override
        public String toString() {
            // Non stampare mai la chiave API
            return "Ai[model=" + model + ", maxTokens=" + maxTokens + ", enabled=" + enabled() + "]";
        }
    }

    public boolean tokenConfigured() {
        return token != null && !token.isBlank();
    }

    @Override
    public String toString() {
        return "AppProperties[tokenConfigured=" + tokenConfigured() + ", allowedOrigins=" + allowedOrigins
                + ", maxUploadMb=" + maxUploadMb + ", backup=" + backup + ", ai=" + ai + "]";
    }
}
