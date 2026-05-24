# Email Nodemailer Tips
- Keep transport option sets environment-specific and validated.
- Use one central DI factory for transport registration.
- Test delivery paths in staging with provider-like settings.
- Keep nodemailer-specific behavior out of business services.
