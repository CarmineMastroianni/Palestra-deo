package it.palestradeo.backend.backup;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BackupRepository extends JpaRepository<BackupEntity, Long> {

    /** Solo metadati: il payload (potenzialmente enorme) non viene caricato. */
    @Query("select new it.palestradeo.backend.backup.BackupDtos$BackupMeta(b.id, b.deviceId, b.createdAt, b.receivedAt, b.size, b.checksum) "
            + "from BackupEntity b order by b.receivedAt desc, b.id desc")
    List<BackupDtos.BackupMeta> findAllMeta();

    @Query("select b.id from BackupEntity b order by b.receivedAt desc, b.id desc")
    List<Long> findIdsNewestFirst();

    Optional<BackupEntity> findFirstByOrderByReceivedAtDescIdDesc();

    @Modifying
    @Query("delete from BackupEntity b where b.id in :ids")
    int deleteByIds(@Param("ids") Collection<Long> ids);

    @Modifying
    @Query("delete from BackupEntity b")
    int deleteAllBackups();
}
