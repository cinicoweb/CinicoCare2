export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida che una password rispetti i requisiti:
 * - Almeno 8 caratteri
 * - Almeno una lettera maiuscola (A-Z)
 * - Almeno un numero (0-9)
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: 'La password deve contenere almeno 8 caratteri.'
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'La password deve contenere almeno una lettera maiuscola (A-Z).'
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'La password deve contenere almeno un numero (0-9).'
    };
  }

  return { isValid: true };
}

/**
 * Valida che la password e la conferma coincidano e rispettino la complessità richiesta.
 */
export function validatePasswordWithConfirmation(password: string, confirmPassword: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, error: 'Inserisci una password.' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: 'Le due password inserite non coincidono. Riprova.' };
  }

  return validatePasswordStrength(password);
}
