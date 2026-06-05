package com.finance.controller;

import com.finance.entity.Expense;
import com.finance.service.ExpenseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    // FIX: require userId as query param so expenses are user-scoped
    @GetMapping
    public ResponseEntity<?> getExpenses(@RequestParam Long userId) {
        try {
            List<Expense> expenses = expenseService.getAllExpenses(userId);
            return ResponseEntity.ok(expenses);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // FIX: @RequestBody ensures Jackson deserializes all fields correctly (no null data)
    @PostMapping
    public ResponseEntity<?> addExpense(@RequestBody Expense expense) {
        try {
            Expense saved = expenseService.saveExpense(expense);
            return ResponseEntity.status(201).body(saved);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateExpense(@PathVariable Long id,
                                           @RequestParam Long userId,
                                           @RequestBody Expense expense) {
        try {
            Expense saved = expenseService.updateExpense(id, userId, expense);
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // FIX: also require userId so users can't delete each other's expenses
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteExpense(@PathVariable Long id,
                                           @RequestParam Long userId) {
        try {
            expenseService.deleteExpense(id, userId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
