package it.palestradeo.backend.backup;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Una versione di backup. Il payload è un blob OPACO già cifrato dal client:
 * il server non lo decodifica né lo ispeziona mai.
 */
@Entity
@Table(name = "backup", indexes = @Index(name = "idx_backup_received", columnList = "receivedAt"))
public class BackupEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 200)
    private String deviceId;

    /** Data di creazione dichiarata dal client (stringa ISO, conservata così com'è). */
    @Column(length = 64)
    private String createdAt;

    @Column(nullable = false)
    private Instant receivedAt;

    @Column(nullable = false)
    private long size;

    @Column(length = 256)
    private String checksum;

    // text su PostgreSQL, varchar molto grande su H2
    @JdbcTypeCode(SqlTypes.LONG32VARCHAR)
    @Column(nullable = false)
    private String payload;

    protected BackupEntity() {}

    public BackupEntity(String deviceId, String createdAt, Instant receivedAt, long size, String checksum, String payload) {
        this.deviceId = deviceId;
        this.createdAt = createdAt;
        this.receivedAt = receivedAt;
        this.size = size;
        this.checksum = checksum;
        this.payload = payload;
    }

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public String getCreatedAt() { return createdAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public long getSize() { return size; }
    public String getChecksum() { return checksum; }
    public String getPayload() { return payload; }
}
