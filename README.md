# Belikeme Clothing Store

Belikeme là nền tảng thương mại điện tử thời trang full-stack, gồm storefront
cho khách hàng, trang quản trị, trợ lý AI phối đồ, thanh toán PayOS, chat hỗ trợ,
quản lý đơn hàng và yêu cầu trả hàng.

Repository này chứa:

- `front/`: Next.js storefront và admin dashboard.
- `backend/`: NestJS REST API, WebSocket gateway và Prisma.
- `backend/prisma/`: schema, migrations và seed data.
- `docker-compose.yml`: PostgreSQL, Redis và backend cho môi trường local.
- `scripts/`: các script hỗ trợ ở cấp repository.

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Công nghệ](#công-nghệ)
- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Các luồng nghiệp vụ chính](#các-luồng-nghiệp-vụ-chính)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Khởi chạy nhanh](#khởi-chạy-nhanh)
- [Biến môi trường](#biến-môi-trường)
- [Database và Prisma](#database-và-prisma)
- [API và Swagger](#api-và-swagger)
- [Kiểm thử và kiểm tra chất lượng](#kiểm-thử-và-kiểm-tra-chất-lượng)
- [Các lệnh hữu ích](#các-lệnh-hữu-ích)
- [Quy trình đóng góp](#quy-trình-đóng-góp)
- [Lưu ý bảo mật](#lưu-ý-bảo-mật)

## Tính năng chính

### Storefront

- Xem danh mục, sản phẩm, biến thể màu và kích cỡ.
- Tìm kiếm, lọc và sắp xếp sản phẩm.
- Giỏ hàng theo tài khoản, kiểm tra tồn kho trước khi cập nhật.
- Checkout với địa chỉ giao hàng và voucher.
- Tạo đơn hàng, theo dõi trạng thái đơn và trạng thái giao hàng.
- Thanh toán PayOS, xử lý return URL, cancel URL và webhook.
- Quản lý hồ sơ, sổ địa chỉ và địa chỉ mặc định.
- Gửi yêu cầu trả hàng và theo dõi kết quả xét duyệt.
- Giao diện song ngữ Anh/Việt.

### Authentication

- Đăng ký và đăng nhập bằng email/mật khẩu.
- Access token, refresh token và HTTP-only cookie.
- Đăng nhập Google OAuth.
- Khôi phục mật khẩu bằng OTP.
- Phân quyền `CUSTOMER`, `STAFF` và `ADMIN`.

### AI và hỗ trợ khách hàng

- Tư vấn phong cách và gợi ý outfit.
- Gợi ý sản phẩm dựa trên catalog và tồn kho thực tế.
- Lưu outfit và thêm toàn bộ outfit vào giỏ hàng.
- AI support với knowledge base được kiểm soát.
- Chat realtime giữa khách hàng và admin qua Socket.IO.

### Admin

- Dashboard thống kê doanh thu, đơn hàng và sản phẩm bán chạy.
- Quản lý danh mục, sản phẩm, biến thể và hình ảnh.
- Quản lý user, role và trạng thái tài khoản.
- Quản lý voucher.
- Theo dõi đơn hàng, thanh toán và tình trạng fulfillment.
- Xét duyệt yêu cầu trả hàng.
- Quản lý landing page và landing gallery.
- Chat hỗ trợ với khách hàng.

## Công nghệ

| Khu vực | Công nghệ |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| 3D/visual | Three.js, React Three Fiber, Drei |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma 7 |
| Database | PostgreSQL 16 |
| Cache | Redis 7, ioredis |
| Realtime | Socket.IO |
| Auth | JWT, refresh token, Google OAuth |
| Payment | PayOS |
| Email | Resend hoặc SMTP/Nodemailer |
| Object storage | Supabase Storage |
| AI provider | OpenRouter-compatible API |
| API docs | Swagger/OpenAPI |
| Test | Vitest |
| Local infrastructure | Docker Compose |

## Kiến trúc tổng quan

```mermaid
flowchart LR
    Customer["Khách hàng"]
    Admin["Admin / Staff"]
    Frontend["Next.js :5175"]
    Backend["NestJS API :3001"]
    Socket["Socket.IO gateway"]
    Postgres[("PostgreSQL :5435")]
    Redis[("Redis :6380")]
    Storage["Supabase Storage"]
    PayOS["PayOS"]
    AI["OpenRouter / AI provider"]
    Email["Resend / SMTP"]

    Customer --> Frontend
    Admin --> Frontend
    Frontend -->|"REST + JWT/cookie"| Backend
    Frontend <-->|"WebSocket"| Socket
    Socket --> Backend
    Backend --> Postgres
    Backend --> Redis
    Backend --> Storage
    Backend --> PayOS
    Backend --> AI
    Backend --> Email
```

Frontend chỉ sử dụng các biến `NEXT_PUBLIC_*` an toàn cho trình duyệt. Database,
Redis, khóa AI, PayOS, email và Supabase service role chỉ được backend truy cập.

## Các luồng nghiệp vụ chính

### 1. Đăng ký, đăng nhập và refresh session

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant UI as Next.js
    participant Auth as Auth API
    participant DB as PostgreSQL

    User->>UI: Nhập email và mật khẩu
    UI->>Auth: POST /auth/login
    Auth->>DB: Kiểm tra user và password hash
    DB-->>Auth: User hợp lệ
    Auth-->>UI: Access token + refresh cookie
    UI->>Auth: GET /auth/me
    Auth-->>UI: Hồ sơ và role

    Note over UI,Auth: Khi access token hết hạn
    UI->>Auth: POST /auth/refresh
    Auth->>DB: Xác minh refresh session
    Auth-->>UI: Access token mới
```

Google OAuth bắt đầu tại `GET /auth/google`. Sau callback, backend chuyển hướng
về `FRONTEND_AUTH_SUCCESS_URL` hoặc `FRONTEND_AUTH_FAILURE_URL`.

### 2. Catalog, giỏ hàng và checkout

```mermaid
flowchart TD
    Browse["Xem / lọc sản phẩm"]
    Variant["Chọn màu và kích cỡ"]
    ValidateVariant{"Biến thể active và còn hàng?"}
    Cart["Thêm vào giỏ hàng"]
    Address["Chọn địa chỉ giao hàng"]
    Voucher["Nhập voucher tùy chọn"]
    Summary["GET /checkout/summary"]
    ValidateCheckout{"Giá, tồn kho và voucher hợp lệ?"}
    Order["POST /checkout/orders"]
    Pending["Tạo đơn PENDING"]
    PaymentChoice{"Phương thức thanh toán"}
    COD["Theo dõi và fulfillment"]
    PayOS["Tạo PayOS payment link"]

    Browse --> Variant --> ValidateVariant
    ValidateVariant -->|Không| Variant
    ValidateVariant -->|Có| Cart
    Cart --> Address --> Voucher --> Summary --> ValidateCheckout
    ValidateCheckout -->|Không| Cart
    ValidateCheckout -->|Có| Order --> Pending --> PaymentChoice
    PaymentChoice -->|COD / không online| COD
    PaymentChoice -->|PayOS| PayOS
```

Backend luôn tính lại giá, tồn kho và điều kiện voucher. Không sử dụng tổng tiền
do browser gửi lên làm nguồn dữ liệu tin cậy.

### 3. Thanh toán PayOS

```mermaid
sequenceDiagram
    actor User as Khách hàng
    participant UI as Next.js
    participant API as Payment API
    participant DB as PostgreSQL
    participant PayOS

    User->>UI: Chọn thanh toán online
    UI->>API: POST /payments/payos/create
    API->>DB: Kiểm tra quyền sở hữu và trạng thái đơn
    API->>PayOS: Tạo payment link
    PayOS-->>API: checkoutUrl và paymentLinkId
    API->>DB: Lưu payment PENDING
    API-->>UI: checkoutUrl
    UI->>PayOS: Chuyển hướng thanh toán
    PayOS-->>API: POST /payments/payos/webhook
    API->>DB: Đối soát và cập nhật payment/order
    PayOS-->>UI: Return hoặc cancel URL
    UI->>API: GET /payments/payos/return/status
    API-->>UI: Trạng thái đã xác minh
```

Webhook là nguồn xác nhận server-to-server. Trang return chỉ hiển thị trạng thái
được backend xác minh, không tự đánh dấu đơn đã thanh toán.

### 4. AI tư vấn outfit và thêm vào giỏ

```mermaid
flowchart TD
    Prompt["Người dùng mô tả phong cách"]
    Scope["Kiểm tra scope, quota và input"]
    Context["Lấy catalog, biến thể và tồn kho"]
    Provider["Gọi AI provider"]
    Validate["Validate và chuẩn hóa output"]
    Result["Hiển thị outfit khả dụng"]
    Decision{"Hành động tiếp theo"}
    Save["POST /saved-outfits"]
    Add["POST /cart/outfit-items"]
    Recheck["Kiểm tra lại active, stock và giá"]
    Cart["Cập nhật giỏ hàng"]

    Prompt --> Scope --> Context --> Provider --> Validate --> Result --> Decision
    Decision -->|Lưu outfit| Save
    Decision -->|Thêm vào giỏ| Add --> Recheck
    Recheck -->|Hợp lệ| Cart
    Recheck -->|Không hợp lệ| Result
```

Kết quả AI không được xem là nguồn dữ liệu catalog. Backend kiểm tra lại ID sản
phẩm, biến thể, trạng thái active và tồn kho trước khi thêm vào giỏ.

### 5. Yêu cầu trả hàng

```mermaid
stateDiagram-v2
    [*] --> Eligible: Đơn đã đủ điều kiện
    Eligible --> Pending: Khách tạo yêu cầu trả hàng
    Pending --> Approved: Admin chấp thuận
    Pending --> Rejected: Admin từ chối
    Approved --> Returned: Cập nhật fulfillment
    Rejected --> [*]
    Returned --> [*]
```

Khách hàng sử dụng `POST /returns` và `GET /returns/my`. Admin sử dụng
`/admin/returns` để xem chi tiết và xét duyệt.

### 6. Chat hỗ trợ realtime

```mermaid
sequenceDiagram
    actor Customer as Khách hàng
    participant Store as Storefront
    participant API as Chat API
    participant WS as Socket.IO
    participant Admin as Admin dashboard
    participant DB as PostgreSQL

    Customer->>Store: Gửi tin nhắn
    Store->>API: POST /chat/me/messages
    API->>DB: Lưu message
    API->>WS: Phát sự kiện conversation
    WS-->>Admin: Tin nhắn mới
    Admin->>API: POST /admin/chats/:id/messages
    API->>DB: Lưu phản hồi
    API->>WS: Phát sự kiện message
    WS-->>Store: Hiển thị phản hồi realtime
```

## Cấu trúc dự án

```text
.
├── backend/
│   ├── prisma/
│   │   ├── migrations/       # Lịch sử migration
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seed data
│   ├── scripts/              # Smoke tests và migration checks
│   └── src/
│       ├── auth/             # Login, JWT, OAuth, password reset
│       ├── catalog/          # Category, product, variant
│       ├── cart/             # Giỏ hàng
│       ├── checkout/         # Summary, voucher, tạo order
│       ├── orders/           # Đơn hàng của khách
│       ├── payments/         # PayOS
│       ├── ai/               # Style advice, support, recommendation
│       ├── chat/             # REST và Socket.IO
│       ├── returns/          # Return requests
│       ├── saved-outfits/    # Outfit đã lưu
│       └── admin-*/          # Các module quản trị
├── front/
│   ├── src/app/              # Next.js App Router pages
│   ├── src/components/       # UI theo domain
│   ├── src/features/         # API clients, hooks, types, utilities
│   ├── src/lib/              # HTTP client và shared utilities
│   └── src/core-utils.test.ts
├── scripts/
├── .env.example
└── docker-compose.yml
```

## Khởi chạy nhanh

### Yêu cầu

- Git.
- Docker Desktop.
- Node.js và npm.
- Tùy chọn: Postman hoặc Insomnia.

### 1. Chuẩn bị environment

Từ thư mục gốc:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Chỉ sử dụng `.env.example` làm template. Không commit `.env` hoặc secret thật.

### 2. Chạy backend, PostgreSQL và Redis

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
```

| Service | Truy cập từ máy host | Địa chỉ trong Docker |
| --- | --- | --- |
| Backend | `http://localhost:3001` | `http://backend:3000` |
| PostgreSQL | `localhost:5435` | `postgres:5432` |
| Redis | `localhost:6380` | `redis:6379` |

Backend trong container phải sử dụng hostname `postgres` và `redis`, không dùng
`localhost:5435` hoặc `localhost:6380`.

### 3. Chạy frontend

Frontend được chạy ngoài Docker:

```bash
cd front
npm install
npm run dev
```

Mở:

- Storefront: `http://localhost:5175`
- Backend API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/api-docs`

Nếu đổi port frontend, cập nhật đồng bộ `CORS_ORIGIN`,
`FRONTEND_AUTH_SUCCESS_URL`, `FRONTEND_AUTH_FAILURE_URL` và
`NEXT_PUBLIC_APP_URL`.

### Chạy backend trực tiếp trên host

```bash
docker compose up -d postgres redis
cd backend
npm install
npm run prisma:validate
npm run prisma:generate
npx prisma migrate dev
npm run start:dev
```

Khi backend chạy trên host, dùng:

```env
PORT=3001
DATABASE_URL=postgresql://belikeme:belikeme_password@localhost:5435/belikeme?schema=public
REDIS_URL=redis://localhost:6380
```

## Biến môi trường

### Core

| Biến | Mục đích |
| --- | --- |
| `NODE_ENV` | Môi trường runtime |
| `PORT` | Port nội bộ của backend |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CORS_ORIGIN` | Danh sách origin được phép |
| `SWAGGER_ENABLED` | Bật Swagger ngoài local |

### Authentication

| Biến | Mục đích |
| --- | --- |
| `JWT_SECRET` | Ký access token |
| `JWT_REFRESH_SECRET` | Ký refresh token |
| `JWT_EXPIRES_IN` | Thời hạn access token |
| `GOOGLE_CLIENT_ID` | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback của backend |

### Tích hợp ngoài

| Nhóm | Biến chính |
| --- | --- |
| PayOS | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` |
| AI | `AI_ENABLED`, `OPENROUTER_API_KEY`, `AI_MODEL`, `AI_BASE_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_IMAGE_BUCKET` |
| Email | `EMAIL_PROVIDER`, `RESEND_API_KEY` hoặc các biến `SMTP_*` |

### Frontend

Chỉ các giá trị an toàn cho browser mới được dùng tiền tố `NEXT_PUBLIC_`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:5175
NEXT_PUBLIC_PAYMENT_RETURN_PATH=/payment/return
```

Không đặt database URL, service role, JWT secret, PayOS key hoặc AI key vào biến
`NEXT_PUBLIC_*`.

## Database và Prisma

Khi backend container khởi động, `backend/docker-entrypoint.sh` chờ PostgreSQL,
chạy:

```bash
npx prisma migrate deploy
```

Sau đó backend được khởi động bằng:

```bash
npm run start:prod
```

`migrate deploy` chỉ áp dụng migration đã commit và không reset dữ liệu.

Các lệnh thường dùng:

```bash
cd backend
npm run prisma:validate
npm run prisma:generate
npm run prisma:seed
node scripts/check-prisma-migrations.mjs
```

## API và Swagger

| Tài nguyên | URL local |
| --- | --- |
| Swagger UI | `http://localhost:3001/api-docs` |
| OpenAPI JSON | `http://localhost:3001/api-docs-json` |
| OpenAPI YAML | `http://localhost:3001/api-docs-yaml` |

Để gọi protected API trong Swagger:

1. Gọi `POST /auth/login`.
2. Sao chép `accessToken`.
3. Chọn **Authorize**.
4. Dán token; Swagger tự gửi header `Bearer <token>`.

Các nhóm endpoint chính:

| Nhóm | Prefix |
| --- | --- |
| Auth | `/auth` |
| Catalog | `/categories`, `/products` |
| Cart và checkout | `/cart`, `/checkout` |
| Orders và payments | `/orders`, `/payments/payos` |
| AI | `/ai` |
| Chat | `/chat` |
| Returns | `/returns` |
| Saved outfits | `/saved-outfits` |
| Admin | `/admin/*` |
| Health | `/health` |

## Kiểm thử và kiểm tra chất lượng

Frontend hiện có 200 test case tự động bao phủ:

- Query serialization và URL composition.
- Phân loại và sắp xếp kích cỡ.
- Kiểm tra tồn kho và chọn biến thể.
- Accessory variant và price override.
- Locale, role redirect và return labels.
- Admin filter helpers và catalog formatting.

Chạy test:

```bash
cd front
npm test
```

Watch mode:

```bash
npm run test:watch
```

Type-check và production build:

```bash
npx tsc --noEmit
npm run build
```

Backend có các smoke test chuyên biệt:

```bash
cd backend
npm run ai:smoke:scope
npm run ai:smoke:style-intent
npm run ai:smoke:style-localization
npm run ai:smoke:style-refinement
npm run ai:smoke:style-v2-lite
npm run cart:outfit-smoke
npm run saved-outfits:smoke
```

Smoke test gọi provider thật yêu cầu credentials và tài khoản test an toàn:

```bash
npm run ai:smoke:real-provider
```

## Health checks

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/db
curl http://localhost:3001/health/redis
```

PowerShell nên dùng `curl.exe` nếu `curl` đang là alias:

```powershell
curl.exe http://localhost:3001/health
curl.exe http://localhost:3001/health/db
curl.exe http://localhost:3001/health/redis
```

## Các lệnh hữu ích

```bash
docker compose logs -f backend
docker compose exec backend sh
docker compose exec postgres psql -U belikeme -d belikeme
docker compose restart backend
docker compose down
```

Lệnh sau xóa toàn bộ PostgreSQL và Redis volume local:

```bash
docker compose down -v
```

Không chạy lệnh xóa volume đối với môi trường chứa dữ liệu cần giữ.

## Quy trình đóng góp

1. Tạo branch mới từ branch chính.
2. Cài dependencies cho phần sẽ thay đổi.
3. Thực hiện thay đổi nhỏ, tập trung vào một mục tiêu.
4. Thêm hoặc cập nhật test.
5. Chạy test, type-check và build.
6. Kiểm tra không có `.env`, secret, `node_modules`, `.next` hoặc `dist`.
7. Commit với message mô tả rõ thay đổi.
8. Push branch và mở pull request.

Ví dụ:

```bash
git switch -c codex/add-catalog-tests
cd front
npm install
npm test
npx tsc --noEmit
npm run build
git status
git add front/src front/package.json front/package-lock.json README.md
git commit -m "test: add storefront core utility coverage"
git push -u origin codex/add-catalog-tests
```

Không dùng `git add .` nếu chưa kiểm tra kỹ các file local và generated output.

## Lưu ý bảo mật

- Không commit `.env`, token, password hoặc API key.
- Không đưa backend secret vào biến `NEXT_PUBLIC_*`.
- Không tin giá tiền, role, trạng thái thanh toán hoặc tồn kho từ browser.
- Luôn xác minh PayOS webhook ở backend.
- Luôn kiểm tra ownership khi truy cập order, address, cart và return request.
- Chỉ role phù hợp mới được phép gọi `/admin/*`.
- Không log password, token, OTP hoặc thông tin thanh toán nhạy cảm.
- Chạy `npm audit` định kỳ và đánh giá thay đổi trước khi dùng `--force`.

## License

Package hiện được đánh dấu `UNLICENSED`. Hãy xác nhận chính sách license của dự
án trước khi phân phối hoặc sử dụng mã nguồn ngoài phạm vi được cho phép.
