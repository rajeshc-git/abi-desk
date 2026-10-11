import { describe, expect, it } from 'vitest';
import { isSystemRobotEmail } from '../../infra/mail/mail.service';

describe('Inbound NDR and Robot Email Filtering', () => {
  describe('isSystemRobotEmail', () => {
    it('detects Microsoft Exchange system NDR mailbox addresses', () => {
      expect(
        isSystemRobotEmail('microsoftexchange329e71ec88ae4615bbc36ab6ce41109e@abi-health.com'),
      ).toBe(true);
      expect(isSystemRobotEmail('microsoftexchange12345@domain.com')).toBe(true);
    });

    it('detects mailer-daemon and postmaster', () => {
      expect(isSystemRobotEmail('mailer-daemon@exchange.domain.com')).toBe(true);
      expect(isSystemRobotEmail('mailer-daemon')).toBe(true);
      expect(isSystemRobotEmail('postmaster@domain.com')).toBe(true);
    });

    it('NEVER flags legitimate human customer email addresses', () => {
      expect(isSystemRobotEmail('john.doe@gmail.com')).toBe(false);
      expect(isSystemRobotEmail('sarah.smith@abi-health.com')).toBe(false);
      expect(isSystemRobotEmail('support@partnercompany.org')).toBe(false);
      expect(isSystemRobotEmail('client123@hospital.in')).toBe(false);
      expect(isSystemRobotEmail('doctor_ravi@clinic.com')).toBe(false);
    });
  });
});
