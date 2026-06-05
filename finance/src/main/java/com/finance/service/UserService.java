package com.finance.service;

import com.finance.dto.*;
import com.finance.entity.Expense;
import com.finance.entity.User;
import com.finance.repository.ExpenseRepository;
import com.finance.repository.PremiumRequestRepository;
import com.finance.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final PremiumRequestRepository premiumRequestRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private static final String ADMIN_EMAIL = "admin@financehub.com";
    private static final String ADMIN_PASSWORD = "admin@123";

    public UserService(UserRepository userRepository,
                       ExpenseRepository expenseRepository,
                       PremiumRequestRepository premiumRequestRepository) {
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.premiumRequestRepository = premiumRequestRepository;
    }

    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        // FIX: use setters instead of @Builder (entity no longer has @Builder)
        User user = new User();
        user.setName(req.getName());
        user.setEmail(req.getEmail());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setPhone(req.getPhone());
        user.setCurrency(req.getCurrency() != null ? req.getCurrency() : "INR");
        user.setRole(isAdminEmail(req.getEmail()) ? "ADMIN" : "USER");
        user.setPremium(true);
        user.setActive(true);
        user.setCreatedAt(java.time.LocalDateTime.now());

        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    public AuthResponse login(LoginRequest req) {
        if (isAdminEmail(req.getEmail())) {
            ensureDefaultAdmin();
        }
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }
        user = ensureAdminAccount(user);
        user = ensureActiveDefault(user);
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new RuntimeException("Account is blocked. Contact admin.");
        }
        user = ensurePremiumAccess(user);
        return toResponse(user);
    }

    public AuthResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user = ensureAdminAccount(user);
        user = ensureActiveDefault(user);
        user = ensurePremiumAccess(user);
        return toResponse(user);
    }

    public AuthResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (req.getName() != null && !req.getName().isBlank()) user.setName(req.getName());
        if (req.getPhone() != null)    user.setPhone(req.getPhone());
        if (req.getCurrency() != null) user.setCurrency(req.getCurrency());

        if (req.getNewPassword() != null && !req.getNewPassword().isBlank()) {
            if (req.getCurrentPassword() == null ||
                    !passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
                throw new RuntimeException("Current password is incorrect");
            }
            user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        }
        user.setPremium(true);
        return toResponse(userRepository.save(user));
    }

    public List<AuthResponse> getAllUsers(Long adminId) {
        requireAdmin(adminId);
        return userRepository.findAll().stream()
                .filter(user -> !"ADMIN".equals(user.getRole()))
                .map(this::ensurePremiumAccess)
                .map(this::toResponse)
                .toList();
    }

    public AuthResponse updatePremium(Long adminId, Long userId, Boolean premium) {
        requireAdmin(adminId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPremium(true);
        return toResponse(userRepository.save(user));
    }

    public AuthResponse updateUserByAdmin(Long adminId, Long userId, UpdateProfileRequest req) {
        requireAdmin(adminId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw new RuntimeException("Admin account cannot be edited here");
        }
        if (req.getName() != null && !req.getName().isBlank()) user.setName(req.getName());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        if (req.getCurrency() != null) user.setCurrency(req.getCurrency());
        return toResponse(userRepository.save(user));
    }

    public AuthResponse updateUserStatus(Long adminId, Long userId, Boolean active) {
        requireAdmin(adminId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw new RuntimeException("Admin account cannot be blocked");
        }
        user.setActive(Boolean.TRUE.equals(active));
        return toResponse(userRepository.save(user));
    }

    public AuthResponse resetUserPassword(Long adminId, Long userId, String newPassword) {
        requireAdmin(adminId);
        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("Password must be at least 6 characters");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw new RuntimeException("Admin password cannot be reset here");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        return toResponse(userRepository.save(user));
    }

    public List<Expense> getUserExpenses(Long adminId, Long userId) {
        requireAdmin(adminId);
        ensureNormalUser(userId);
        return expenseRepository.findByUserId(userId);
    }

    public Expense addUserExpense(Long adminId, Long userId, Expense expense) {
        requireAdmin(adminId);
        ensureNormalUser(userId);
        expense.setUserId(userId);
        validateExpense(expense);
        return expenseRepository.save(expense);
    }

    public Expense updateUserExpense(Long adminId, Long userId, Long expenseId, Expense updatedExpense) {
        requireAdmin(adminId);
        ensureNormalUser(userId);
        Expense existing = expenseRepository.findByIdAndUserId(expenseId, userId)
                .orElseThrow(() -> new RuntimeException("Expense not found"));
        existing.setTitle(updatedExpense.getTitle());
        existing.setAmount(updatedExpense.getAmount());
        existing.setCategory(updatedExpense.getCategory());
        existing.setDescription(updatedExpense.getDescription());
        existing.setDate(updatedExpense.getDate());
        validateExpense(existing);
        return expenseRepository.save(existing);
    }

    @Transactional
    public void deleteUserExpense(Long adminId, Long userId, Long expenseId) {
        requireAdmin(adminId);
        ensureNormalUser(userId);
        expenseRepository.deleteByIdAndUserId(expenseId, userId);
    }

    @Transactional
    public void deleteUser(Long adminId, Long userId) {
        requireAdmin(adminId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw new RuntimeException("Admin account cannot be deleted");
        }
        expenseRepository.deleteByUserId(userId);
        premiumRequestRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    private User ensureNormalUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw new RuntimeException("Admin account is not managed here");
        }
        return user;
    }

    private void validateExpense(Expense expense) {
        if (expense.getTitle() == null || expense.getTitle().isBlank()) {
            throw new RuntimeException("Title is required");
        }
        if (expense.getAmount() == null || expense.getAmount() <= 0) {
            throw new RuntimeException("Amount must be positive");
        }
        if (expense.getUserId() == null) {
            throw new RuntimeException("userId is required");
        }
    }

    private void requireAdmin(Long adminId) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        admin = ensureAdminAccount(admin);
        if (!"ADMIN".equals(admin.getRole())) {
            throw new RuntimeException("Admin access required");
        }
    }

    public void ensureDefaultAdmin() {
        User admin = userRepository.findByEmail(ADMIN_EMAIL).orElseGet(User::new);
        admin.setName("FinanceHub Admin");
        admin.setEmail(ADMIN_EMAIL);
        admin.setPassword(passwordEncoder.encode(ADMIN_PASSWORD));
        admin.setRole("ADMIN");
        admin.setPremium(true);
        admin.setActive(true);
        admin.setCurrency(admin.getCurrency() != null ? admin.getCurrency() : "INR");
        admin.setCreatedAt(admin.getCreatedAt() != null ? admin.getCreatedAt() : java.time.LocalDateTime.now());
        userRepository.save(admin);
    }

    private boolean isAdminEmail(String email) {
        return ADMIN_EMAIL.equalsIgnoreCase(email);
    }

    private User ensureAdminAccount(User user) {
        if (!isAdminEmail(user.getEmail())) {
            return user;
        }
        boolean changed = false;
        if (!"ADMIN".equals(user.getRole())) {
            user.setRole("ADMIN");
            changed = true;
        }
        if (!Boolean.TRUE.equals(user.getPremium())) {
            user.setPremium(true);
            changed = true;
        }
        return changed ? userRepository.save(user) : user;
    }

    private User ensureActiveDefault(User user) {
        if (user.getActive() != null) {
            return user;
        }
        user.setActive(true);
        return userRepository.save(user);
    }

    private User ensurePremiumAccess(User user) {
        if (Boolean.TRUE.equals(user.getPremium())) {
            return user;
        }
        user.setPremium(true);
        return userRepository.save(user);
    }

    private AuthResponse toResponse(User u) {
        return new AuthResponse(
                "user_" + u.getId(),
                u.getId(),
                u.getName(),
                u.getEmail(),
                u.getPhone(),
                u.getCurrency() != null ? u.getCurrency() : "INR",
                u.getRole(),
                u.getCreatedAt() != null ? u.getCreatedAt().toLocalDate().toString() : "",
                Boolean.TRUE.equals(u.getPremium()),
                u.getActive() == null || Boolean.TRUE.equals(u.getActive())
        );
    }
}
