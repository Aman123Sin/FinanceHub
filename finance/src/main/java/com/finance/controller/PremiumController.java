package com.finance.controller;

import com.finance.entity.PremiumRequest;
import com.finance.entity.User;
import com.finance.repository.PremiumRequestRepository;
import com.finance.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Map;

@RestController
@RequestMapping("/premium")
public class PremiumController {

    private final PremiumRequestRepository premiumRequestRepository;
    private final UserRepository userRepository;

    public PremiumController(PremiumRequestRepository premiumRequestRepository,
                             UserRepository userRepository) {
        this.premiumRequestRepository = premiumRequestRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/requests")
    public ResponseEntity<?> createRequest(@RequestBody PremiumRequestInput input) {
        try {
            User user = userRepository.findById(input.userId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            YearMonth currentMonth = YearMonth.now();
            boolean alreadySubmittedThisMonth = premiumRequestRepository.findByUserId(user.getId()).stream()
                    .anyMatch(request -> request.getCreatedAt() != null &&
                            YearMonth.from(request.getCreatedAt()).equals(currentMonth));
            if (alreadySubmittedThisMonth) {
                throw new RuntimeException("You can send only one payment receipt in a month.");
            }
            PremiumRequest request = new PremiumRequest();
            request.setUserId(user.getId());
            request.setName(user.getName());
            request.setEmail(user.getEmail());
            request.setAmount(input.amount());
            request.setProofImage(input.proofImage());
            request.setStatus("APPROVED");
            request.setCreatedAt(LocalDateTime.now());
            user.setPremium(true);
            userRepository.save(user);
            return ResponseEntity.status(201).body(premiumRequestRepository.save(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/requests/latest")
    public ResponseEntity<?> latestRequest(@RequestParam Long userId) {
        return ResponseEntity.ok(premiumRequestRepository.findTopByUserIdOrderByCreatedAtDesc(userId).orElse(null));
    }

    @GetMapping("/admin/requests")
    public ResponseEntity<?> adminRequests(@RequestParam Long adminId) {
        try {
            requireAdmin(adminId);
            return ResponseEntity.ok(premiumRequestRepository.findAllByOrderByCreatedAtDesc());
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/admin/requests/{id}")
    public ResponseEntity<?> reviewRequest(@RequestParam Long adminId,
                                           @PathVariable Long id,
                                           @RequestBody ReviewInput input) {
        try {
            requireAdmin(adminId);
            PremiumRequest request = premiumRequestRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Request not found"));
            request.setStatus(Boolean.TRUE.equals(input.approved()) ? "APPROVED" : "REJECTED");
            PremiumRequest saved = premiumRequestRepository.save(request);

            if (Boolean.TRUE.equals(input.approved())) {
                User user = userRepository.findById(request.getUserId())
                        .orElseThrow(() -> new RuntimeException("User not found"));
                user.setPremium(true);
                userRepository.save(user);
            }
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/admin/requests/{id}")
    public ResponseEntity<?> deleteRequest(@RequestParam Long adminId,
                                           @PathVariable Long id) {
        try {
            requireAdmin(adminId);
            if (!premiumRequestRepository.existsById(id)) {
                throw new RuntimeException("Request not found");
            }
            premiumRequestRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    private void requireAdmin(Long adminId) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        if (!"ADMIN".equals(admin.getRole())) {
            throw new RuntimeException("Admin access required");
        }
    }

    record PremiumRequestInput(Long userId, Double amount, String proofImage) {}
    record ReviewInput(Boolean approved) {}
}
