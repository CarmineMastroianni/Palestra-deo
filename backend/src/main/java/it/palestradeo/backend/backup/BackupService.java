package it.palestradeo.backend.backup;

import it.palestradeo.backend.config.AppProperties;
import it.palestradeo.backend.web.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private final BackupRepository repo;
    private final int maxVersions;

    public BackupService(BackupRepository repo, AppProperties props) {
        this.repo = repo;
        this.maxVersions = Math.max(1, props.backup().maxVersions());
    }

    @Transactional
    public BackupDtos.BackupSaved save(BackupDtos.BackupRequest req) {
        String payload = req.payload();
        long size = payload.getBytes(StandardCharsets.UTF_8).length;
        BackupEntity saved = repo.save(new BackupEntity(
                req.deviceId(), req.createdAt(), Instant.now(), size, req.checksum(), payload));
        prune();
        log.info("Backup salvato: id={} size={} bytes device={}", saved.getId(), size, req.deviceId());
        return new BackupDtos.BackupSaved(saved.getId(), saved.getCreatedAt(), saved.getReceivedAt(), size);
    }

    private void prune() {
        repo.flush();
        List<Long> ids = repo.findIdsNewestFirst();
        if (ids.size() > maxVersions) {
            List<Long> toDelete = ids.subList(maxVersions, ids.size());
            int n = repo.deleteByIds(toDelete);
            log.info("Eliminate {} versioni di backup oltre il limite di {}", n, maxVersions);
        }
    }

    @Transactional(readOnly = true)
    public List<BackupDtos.BackupMeta> list() {
        return repo.findAllMeta();
    }

    @Transactional(readOnly = true)
    public BackupDtos.BackupFull latest() {
        return repo.findFirstByOrderByReceivedAtDescIdDesc()
                .map(BackupDtos.BackupFull::of)
                .orElseThrow(() -> new NotFoundException("Nessun backup presente"));
    }

    @Transactional(readOnly = true)
    public BackupDtos.BackupFull get(long id) {
        return repo.findById(id)
                .map(BackupDtos.BackupFull::of)
                .orElseThrow(() -> new NotFoundException("Backup non trovato"));
    }

    @Transactional
    public int deleteAll() {
        int n = repo.deleteAllBackups();
        log.info("Eliminati tutti i backup ({})", n);
        return n;
    }
}
