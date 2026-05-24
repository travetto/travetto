# Model Query Maintainer Tips
- The verifier is part of the user-facing contract because it defines what queries are accepted.
- Be conservative with operator additions unless at least one concrete provider can honor them.
- Keep utility helpers aligned with expiry and polymorphism behavior from core model and schema.
- When in doubt, let support tests define the portable surface area.