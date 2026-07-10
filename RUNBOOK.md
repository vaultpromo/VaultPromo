# PromoVault — Deployment Runbook

## Stack summary

| Layer | Service | Notes |
|-------|---------|-------|
| App (Next.js) | Vercel | Free tier starts here |
| Database | Neon Postgres | Auto-resumes on request, no manual reactivation |
| Storage | Cloudflare R2 | S3-compatible, egress-free |
| Email | Resend | 3k/month free tier |
| Audio worker | AWS Lambda (container) | Scales to zero, pay-per-invocation |
| Job queue | pg-boss (Neon) | No extra infra needed |

---

## 1. Prerequisites

- Node.js ≥ 20, npm ≥ 11
- AWS CLI configured (`~/.aws/credentials` with an IAM user)
- Docker (for Lambda container build)
- Accounts: Neon, Cloudflare, Resend, Vercel, AWS

---

## 2. First-time setup

### 2a. Clone and install

```bash
cd FatdropIMP
npm install
```

### 2b. Environment variables

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

| Variable | How to get it |
|----------|---------------|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → Overview |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 → Manage R2 API tokens |
| `R2_SECRET_ACCESS_KEY` | Same as above |
| `R2_BUCKET_ORIGINALS` | Create bucket, e.g. `promovault-originals` |
| `R2_BUCKET_PREVIEWS` | Create bucket, e.g. `promovault-previews` |
| `RESEND_API_KEY` | Resend dashboard → API keys |
| `EMAIL_FROM` | Verified domain in Resend, e.g. `noreply@yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://promovault.vercel.app` |
| `PIPELINE_WEBHOOK_SECRET` | `openssl rand -base64 32` |

### 2c. Neon database setup

```bash
# Apply all migrations to your Neon database
npm run db:migrate

# Optionally seed with test data
npm run db:seed
```

### 2d. Cloudflare R2 bucket configuration

In the Cloudflare dashboard for each bucket:
- Set **Access** to **Private** (no public access)
- No CORS rules needed (all access is via presigned URLs server-side)

---

## 3. Lambda audio worker deployment

### 3a. Build the container

```bash
cd lambda/audio-worker
npm install
docker build -t promovault-audio-worker .
```

### 3b. Push to ECR and deploy

```bash
# Create ECR repository (once)
aws ecr create-repository --repository-name promovault-audio-worker --region us-east-1

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag promovault-audio-worker:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/promovault-audio-worker:latest
docker push \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/promovault-audio-worker:latest

# Create Lambda function (first time)
aws lambda create-function \
  --function-name promovault-audio-worker \
  --package-type Image \
  --code ImageUri=<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/promovault-audio-worker:latest \
  --role arn:aws:iam::<AWS_ACCOUNT_ID>:role/lambda-basic-execution \
  --timeout 900 \
  --memory-size 1024 \
  --environment Variables="{
    DATABASE_URL=<your-neon-url>,
    R2_ACCOUNT_ID=<your-r2-account-id>,
    R2_ACCESS_KEY_ID=<your-r2-key>,
    R2_SECRET_ACCESS_KEY=<your-r2-secret>,
    R2_BUCKET_ORIGINALS=promovault-originals,
    R2_BUCKET_PREVIEWS=promovault-previews,
    PIPELINE_WEBHOOK_SECRET=<your-webhook-secret>,
    NEXT_PUBLIC_APP_URL=<your-vercel-url>
  }"

# Update Lambda on subsequent deploys
aws lambda update-function-code \
  --function-name promovault-audio-worker \
  --image-uri <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/promovault-audio-worker:latest
```

### 3c. Lambda IAM role

The Lambda execution role needs:
- `AWSLambdaBasicExecutionRole` (CloudWatch logs)
- No S3 permissions needed — storage access is via R2 HTTP API with credentials in env vars

---

## 4. Vercel deployment

### 4a. First deploy

```bash
npm install -g vercel
vercel --prod
```

### 4b. Environment variables on Vercel

Add all variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**. Set them for **Production**, **Preview**, and **Development** as appropriate.

Critical: `NEXT_PUBLIC_APP_URL` must be set to the actual Vercel deployment URL.

### 4c. Subsequent deploys

```bash
git add -A
git commit -m "feat: describe your change"
git push origin main  # Vercel auto-deploys on push to main
```

---

## 5. Resend domain configuration

1. Add your sending domain in the Resend dashboard
2. Add the provided SPF, DKIM, and DMARC DNS records to your domain
3. Verify the domain before sending to real recipients

---

## 6. Development workflow

```bash
# Start dev server
npm run dev

# Run unit tests (watch mode)
npm run test:watch

# Run unit tests once
npm test

# Run e2e tests (requires dev server running)
npm run test:e2e

# Generate Drizzle migrations after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio (DB browser)
npm run db:studio

# Format code
npm run format

# Build for production
npm run build
```

---

## 7. Security checklist for production

- [ ] `AUTH_SECRET` is a unique 32-byte random value (not the example)
- [ ] `PIPELINE_WEBHOOK_SECRET` is a unique 32-byte random value
- [ ] Both R2 buckets are **private** (no public access configured)
- [ ] Resend domain is verified with SPF + DKIM + DMARC records
- [ ] Lambda function has minimal IAM permissions (no S3, no broad AWS access)
- [ ] `NEXT_PUBLIC_APP_URL` matches the actual deployed URL exactly
- [ ] Neon connection string uses `sslmode=require`
- [ ] Vercel environment variables are set (not committed to git)

---

## 8. Scaling notes

**Current free-tier limits (approximate):**
- Neon: 0.5 CPU / 1 GB RAM compute, 512 MB storage, auto-suspend
- Cloudflare R2: 10 GB storage, 1M Class A ops/month, egress-free
- Resend: 3,000 emails/month, 100/day
- AWS Lambda: 1M free requests/month, 400,000 GB-seconds compute

**When to upgrade:**
- **Neon**: Upgrade when >5GB storage or compute timeouts under load
- **R2**: Stays cheap for most indie label usage — only storage cost
- **Resend**: Upgrade to Pro ($20/mo) when >3k emails/month
- **Lambda**: Unlikely to exceed free tier for audio transcoding at indie scale

**No migrations needed to upgrade**: all abstraction layers (StorageProvider, EmailProvider) allow swapping providers by changing one file.

---

## 9. Troubleshooting

| Symptom | Check |
|---------|-------|
| Track stuck on "processing" | Check Lambda logs in CloudWatch; verify `PIPELINE_WEBHOOK_SECRET` matches |
| Emails not arriving | Check Resend dashboard for bounces; verify domain SPF/DKIM |
| Download fails after feedback | Check Lambda R2 credentials; check `watermarked/` key exists in bucket |
| Auth errors on login | Verify `AUTH_SECRET` is set and consistent across deploys |
| `delivery_token` not working | Verify `NEXT_PUBLIC_APP_URL` matches the URL in the email link |
| Neon connection timeout | Expected on cold start (~500ms) — retry once; if persistent, check connection string |
