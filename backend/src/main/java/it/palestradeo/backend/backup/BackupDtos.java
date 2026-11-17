package it.palestradeo.backend.backup;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class BackupDtos {
    private BackupDtos() {}

    public record BackupRequest(
            @Size(max = 200, message = "deviceId troppo lungo") String deviceId,
            @Size(max = 64, message = "createdAt troppo lungo") String createdAt,
            @NotBlank(message = "Il payload del backup è vuoto") String payload,
            @Size(max = 256, message = "checksum troppo lungo") String checksum) {}

    public record BackupSaved(Long id, String createdAt, Instant receivedAt, long size) {}

    public record BackupMeta(Long id, String deviceId, String createdAt, Instant receivedAt, long size, String checksum) {}

    public record BackupFull(Long id, String deviceId, String createdAt, Instant receivedAt, long size,
                             String checksum, String payload) {
        static BackupFull of(BackupEntity e) {
            return new BackupFull(e.getId(), e.getDeviceId(), e.getCreatedAt(), e.getReceivedAt(), e.getSize(),
                    e.getChecksum(), e.getPayload());
        }
    }
}
