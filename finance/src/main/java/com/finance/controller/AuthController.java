package com.finance.controller;

import com.finance.dto.*;
import com.finance.entity.Expense;
import com.finance.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        try {
            AuthResponse response = userService.register(req);
            return ResponseEntity.status(201).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            AuthResponse response = userService.login(req);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/profile/{userId}")
    public ResponseEntity<?> getProfile(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userService.getProfile(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/profile/{userId}")
    public ResponseEntity<?> updateProfile(@PathVariable Long userId,
                                           @RequestBody UpdateProfileRequest req) {
        try {
            return ResponseEntity.ok(userService.updateProfile(userId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/admin/users")
    public ResponseEntity<?> getUsers(@RequestParam Long adminId) {
        try {
            return ResponseEntity.ok(userService.getAllUsers(adminId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/users/{userId}/premium")
    public ResponseEntity<?> updatePremium(@RequestParam Long adminId,
                                           @PathVariable Long userId,
                                           @RequestBody PremiumRequest req) {
        try {
            return ResponseEntity.ok(userService.updatePremium(adminId, userId, req.premium()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/admin/users/{userId}")
    public ResponseEntity<?> deleteUser(@RequestParam Long adminId,
                                        @PathVariable Long userId) {
        try {
            userService.deleteUser(adminId, userId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/users/{userId}")
    public ResponseEntity<?> updateUser(@RequestParam Long adminId,
                                        @PathVariable Long userId,
                                        @RequestBody UpdateProfileRequest req) {
        try {
            return ResponseEntity.ok(userService.updateUserByAdmin(adminId, userId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/users/{userId}/status")
    public ResponseEntity<?> updateUserStatus(@RequestParam Long adminId,
                                              @PathVariable Long userId,
                                              @RequestBody StatusRequest req) {
        try {
            return ResponseEntity.ok(userService.updateUserStatus(adminId, userId, req.active()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/users/{userId}/password")
    public ResponseEntity<?> resetUserPassword(@RequestParam Long adminId,
                                               @PathVariable Long userId,
                                               @RequestBody PasswordRequest req) {
        try {
            return ResponseEntity.ok(userService.resetUserPassword(adminId, userId, req.newPassword()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/admin/users/{userId}/expenses")
    public ResponseEntity<?> getUserExpenses(@RequestParam Long adminId,
                                             @PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userService.getUserExpenses(adminId, userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/admin/users/{userId}/expenses")
    public ResponseEntity<?> addUserExpense(@RequestParam Long adminId,
                                            @PathVariable Long userId,
                                            @RequestBody Expense expense) {
        try {
            return ResponseEntity.status(201).body(userService.addUserExpense(adminId, userId, expense));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/users/{userId}/expenses/{expenseId}")
    public ResponseEntity<?> updateUserExpense(@RequestParam Long adminId,
                                               @PathVariable Long userId,
                                               @PathVariable Long expenseId,
                                               @RequestBody Expense expense) {
        try {
            return ResponseEntity.ok(userService.updateUserExpense(adminId, userId, expenseId, expense));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/admin/users/{userId}/expenses/{expenseId}")
    public ResponseEntity<?> deleteUserExpense(@RequestParam Long adminId,
                                               @PathVariable Long userId,
                                               @PathVariable Long expenseId) {
        try {
            userService.deleteUserExpense(adminId, userId, expenseId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(new ErrorResponse(e.getMessage()));
        }
    }

    record ErrorResponse(String error) {}
    record PremiumRequest(Boolean premium) {}
    record StatusRequest(Boolean active) {}
    record PasswordRequest(String newPassword) {}
}
