# Razorpay Test Mode Setup

Use Razorpay **Test Mode** API credentials in `backend/.env`:

```dotenv
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

The backend creates INR orders and verifies payment signatures and captured payment details. The secret and webhook secret stay on the server. `frontend/.env.example` contains only the public key variable; checkout uses the public key returned by the backend.

Enable automatic payment capture in the Razorpay Test Mode dashboard so successful payments reach the captured state before entering the kitchen queue. For webhook testing, create a Test Mode webhook pointing to `https://<public-host>/api/payments/webhook` and subscribe to `payment.captured` and `payment.failed`. Razorpay requires a publicly reachable URL; localhost can be tested through a secure tunnel. Set the webhook secret generated in the dashboard as `RAZORPAY_WEBHOOK_SECRET`. Local checkout does not depend on webhook delivery because the authenticated checkout callback is verified against Razorpay's Payments API.

Do not configure live credentials until production deployment, HTTPS, webhook delivery, capture settings, and payment reconciliation have been reviewed.
