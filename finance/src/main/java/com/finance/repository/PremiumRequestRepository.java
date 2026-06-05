package com.finance.repository;

import com.finance.entity.PremiumRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PremiumRequestRepository extends JpaRepository<PremiumRequest, Long> {
    List<PremiumRequest> findAllByOrderByCreatedAtDesc();
    List<PremiumRequest> findByUserId(Long userId);
    Optional<PremiumRequest> findTopByUserIdOrderByCreatedAtDesc(Long userId);
    void deleteByUserId(Long userId);
}
