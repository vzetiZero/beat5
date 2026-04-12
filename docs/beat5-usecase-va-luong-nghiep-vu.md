# Beat5 Use Case Và Luồng Nghiệp Vụ

## 1. Mục tiêu hệ thống

Hệ thống `Beat5` là ứng dụng nội bộ quản lý:

- Hợp đồng trả góp
- Cửa hàng
- Nhân viên
- Phân quyền nhân viên
- Lịch sử thao tác
- Thùng rác khôi phục dữ liệu

Ngoài dữ liệu nội bộ, hệ thống còn:

- Đăng nhập qua `2gold.biz`
- Proxy một số API/page từ hệ thống ngoài
- Lưu session/cookie remote để người dùng thao tác liên tục

## 2. Tác nhân chính

- `Admin`
  - Toàn quyền hệ thống
  - Truy cập mọi cửa hàng
  - Phân quyền nhân viên
  - Quản lý thùng rác
- `Nhân viên`
  - Đăng nhập hệ thống
  - Truy cập theo module được cấp
  - Truy cập theo phạm vi cửa hàng được cấp
- `Hệ thống remote 2gold.biz`
  - Xác thực đăng nhập
  - Cung cấp một phần page/API nguồn

## 3. Use case tổng quan

```mermaid
flowchart TD
    A[Người dùng] --> B[Đăng nhập]
    B --> C{Xác thực thành công?}
    C -- Không --> D[Hiển thị lỗi đăng nhập]
    C -- Có --> E[Khởi tạo session và quyền truy cập]

    E --> F[Quản lý trả góp]
    E --> G[Quản lý cửa hàng]
    E --> H[Quản lý nhân viên]
    E --> I[Phân quyền]
    E --> J[Lịch sử thao tác]
    E --> K[Thùng rác]
    E --> L[Proxy page/API remote]

    F --> F1[Xem danh sách]
    F --> F2[Thêm mới]
    F --> F3[Cập nhật]
    F --> F4[Import Excel]
    F --> F5[Đổi trạng thái]
    F --> F6[Cập nhật tiến độ đóng]
    F --> F7[Xóa / xóa hàng loạt]

    G --> G1[Xem danh sách]
    G --> G2[Thêm / sửa]
    G --> G3[Đổi trạng thái]
    G --> G4[Xóa / chuyển dữ liệu]

    H --> H1[Xem danh sách]
    H --> H2[Thêm / sửa]
    H --> H3[Đổi trạng thái]
    H --> H4[Xóa / chuyển dữ liệu]

    I --> I1[Cấp role]
    I --> I2[Cấp module permission]
    I --> I3[Cấp phạm vi cửa hàng]

    J --> J1[Xem log]
    J --> J2[Lọc log]
    J --> J3[Export Excel]

    K --> K1[Xem dữ liệu đã xóa]
    K --> K2[Khôi phục]
```

## 4. Luồng tổng quan hệ thống

```mermaid
flowchart LR
    U[User] --> W[Web UI]
    W --> A[Express App]
    A --> S[Session + Auth Middleware]
    A --> DB[(SQLite Local DB)]
    A --> R[Remote 2gold.biz]
    A --> L[Audit Log]
    A --> T[Trash Store]
```

Ý nghĩa:

- `Web UI`: giao diện người dùng thao tác
- `Express App`: xử lý route, validate, phân quyền
- `Session + Auth`: xác thực và giới hạn truy cập
- `SQLite Local DB`: lưu dữ liệu nội bộ
- `Remote 2gold.biz`: nguồn đăng nhập và một phần dữ liệu/trang remote
- `Audit Log`: lưu lịch sử thao tác
- `Trash Store`: lưu snapshot để khôi phục sau xóa

## 5. Luồng đăng nhập và phân quyền

### 5.1 Đăng nhập

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Login Page
    participant APP as Express App
    participant REMOTE as 2gold.biz
    participant DB as Local Staff Store

    U->>UI: Nhập tài khoản/mật khẩu
    UI->>APP: POST /login
    APP->>DB: Kiểm tra local staff nếu có
    APP->>REMOTE: loginTo2Gold(username, password)
    REMOTE-->>APP: Cookie + thông tin user + menu
    APP-->>UI: Tạo session, redirect vào hệ thống
```

### 5.2 Phân quyền

Logic phân quyền hiện có:

- Nếu chưa đăng nhập:
  - bị chuyển về `/login`
- Nếu là `admin`:
  - có toàn quyền module
  - có toàn quyền cửa hàng
- Nếu là nhân viên:
  - chỉ vào được module đã được cấp
  - chỉ xem/sửa dữ liệu của cửa hàng được cấp

Ba lớp kiểm soát:

- `requireAuth`
- `requireModulePermission(module)`
- `requireAdmin`

## 6. Use case theo module

### 6.1 Trả góp

Mục đích:

- Quản lý hợp đồng trả góp nội bộ
- Theo dõi tiến độ đóng tiền theo kỳ
- Cảnh báo sắp đến hạn, đến hạn hôm nay, quá hạn

Use case chính:

1. Xem danh sách hợp đồng
2. Lọc theo cửa hàng, trạng thái, ngày, số ngày vay
3. Thêm mới hợp đồng
4. Cập nhật hợp đồng
5. Import Excel
6. Đổi trạng thái hợp đồng
7. Cập nhật tiến độ đóng tiền theo kỳ
8. Xóa mềm vào thùng rác
9. Xóa hàng loạt

Luồng nghiệp vụ:

```mermaid
flowchart TD
    A[Xem danh sách trả góp] --> B[Tải hợp đồng từ SQLite]
    B --> C[Tính lịch đóng theo kỳ]
    C --> D[Xác định kỳ chưa đóng tiếp theo]
    D --> E[Tính dueStatus]
    E --> F[Hiển thị danh sách]

    F --> G[Cập nhật trạng thái]
    G --> H[Lưu status_code/status_text]

    F --> I[Mở chi tiết hợp đồng]
    I --> J[Tick các kỳ đã đóng]
    J --> K[Lưu collection_progress]
    K --> L[Tính lại paid_before và kỳ kế tiếp]
    L --> M[Cập nhật trạng thái Đã đóng hoặc Đang vay]
```

Logic quan trọng đang có:

- Hợp đồng được chia thành nhiều kỳ dựa trên:
  - `loanDate`
  - `loanDays`
  - `collectionIntervalDays`
  - `revenue`
- `collection_progress` lưu các kỳ đã đóng
- Kỳ chưa đóng tiếp theo quyết định:
  - ngày phải đóng tiếp theo
  - `dueStatus`
  - cảnh báo `sắp đến hạn`, `đến hạn hôm nay`, `quá hạn`
- Nếu tất cả kỳ đã đóng:
  - trạng thái được cập nhật sang `Đã đóng`

Quy tắc cảnh báo hiện tại:

- `due_today`: kỳ chưa đóng tiếp theo đến hạn hôm nay
- `due_soon`: kỳ chưa đóng tiếp theo trong vòng 3 ngày tới
- `overdue`: kỳ chưa đóng tiếp theo đã qua hạn

### 6.2 Cửa hàng

Use case:

1. Xem danh sách cửa hàng
2. Thêm mới / cập nhật cửa hàng
3. Đổi trạng thái hoạt động
4. Xóa cửa hàng
5. Xóa nhiều cửa hàng
6. Chuyển dữ liệu sang cửa hàng khác trước khi xóa

Logic quan trọng:

- Xóa cửa hàng có thể yêu cầu chuyển dữ liệu trả góp liên quan
- Một số thao tác chỉ `admin` mới làm được

### 6.3 Nhân viên

Use case:

1. Xem danh sách nhân viên
2. Thêm mới / cập nhật nhân viên
3. Đổi trạng thái làm việc
4. Xóa nhân viên
5. Xóa hàng loạt
6. Chuyển dữ liệu hợp đồng sang nhân viên khác trước khi xóa

Logic quan trọng:

- Nhân viên bị khóa thì không được đăng nhập
- Có kiểm tra phạm vi cửa hàng trước khi thao tác

### 6.4 Phân quyền

Use case:

1. Chọn nhân viên
2. Gán role
3. Gán quyền module
4. Gán quyền truy cập tất cả cửa hàng hoặc danh sách cửa hàng cụ thể

Chỉ `admin` được thao tác.

### 6.5 Lịch sử thao tác

Use case:

1. Xem log thao tác
2. Lọc theo:
  - module
  - action
  - user
  - shop
  - thời gian
3. Export Excel

Nguồn log:

- login/logout
- context switch cửa hàng
- create/update/delete/bulk action
- import
- restore
- export
- access page

### 6.6 Thùng rác

Use case:

1. Xem danh sách dữ liệu đã xóa
2. Khôi phục cửa hàng
3. Khôi phục nhân viên
4. Khôi phục hợp đồng

Logic:

- Trước khi xóa, hệ thống lưu snapshot vào trash
- Khi restore, hệ thống kiểm tra ràng buộc dữ liệu gốc

## 7. Sơ đồ luồng chi tiết trả góp

### 7.1 Thêm / sửa hợp đồng

```mermaid
flowchart TD
    A[User nhập form hợp đồng] --> B[Validate dữ liệu]
    B --> C[Chuẩn hóa ngày, số tiền, trạng thái]
    C --> D[Tính collection interval / prepaid period]
    D --> E[Lưu SQLite]
    E --> F[Ghi audit log]
```

### 7.2 Import Excel

```mermaid
flowchart TD
    A[Chọn file Excel] --> B[Đọc sheet đầu tiên]
    B --> C[Map cột theo header]
    C --> D[Chuẩn hóa tiền/ngày]
    D --> E[Chuẩn hóa log import]
    E --> F[Lưu từng hợp đồng vào SQLite]
    F --> G[Lưu lịch sử import]
    G --> H[Ghi audit log]
```

### 7.3 Cập nhật tiến độ đóng tiền

```mermaid
flowchart TD
    A[Mở chi tiết hợp đồng] --> B[Hiển thị các kỳ đóng]
    B --> C[User tick các kỳ đã đóng]
    C --> D[POST /installment/api/progress/:id]
    D --> E[Tính lại collection_progress]
    E --> F[Tính paid_before]
    F --> G[Xác định kỳ chưa đóng tiếp theo]
    G --> H[Cập nhật payment_day]
    H --> I[Cập nhật status_text]
    I --> J[Ghi audit log]
```

## 8. Route nghiệp vụ chính

### 8.1 Auth

- `GET /login`
- `POST /login`
- `POST /logout`
- `POST /context/shop`

### 8.2 Trả góp

- `GET /Installment/Index/`
- `GET /Installment/Create`
- `GET /Installment/Edit/:id`
- `POST /Installment/Create`
- `POST /Installment/Edit/:id`
- `GET /installment/api/list`
- `POST /installment/api/import`
- `DELETE /installment/api/:id`
- `POST /installment/api/bulk-delete`
- `POST /installment/api/bulk-status`
- `POST /installment/api/progress/:id`

### 8.3 Cửa hàng

- `GET /Shop/Index/`
- `GET /Shop/Create`
- `GET /Shop/Edit/:id`
- `POST /Shop/Create`
- `GET /shop/api/list`
- `GET /shop/api/localities/wards`
- `GET /shop/api/transfer-options`
- `DELETE /shop/api/:id`
- `POST /shop/api/bulk-delete`
- `POST /shop/api/bulk-status`

### 8.4 Nhân viên

- `GET /Staff/Index/`
- `GET /Staff/Create`
- `POST /Staff/Create`
- `GET /staff/api/list`
- `GET /staff/api/transfer-options`
- `DELETE /staff/api/:id`
- `POST /staff/api/bulk-delete`
- `POST /staff/api/bulk-status`

### 8.5 Phân quyền

- `GET /Staff/PermissionStaff/`
- `POST /Staff/PermissionStaff/:id`

### 8.6 Lịch sử và thùng rác

- `GET /History/`
- `GET /History/Export`
- `GET /Trash/Index/`
- `GET /trash/api/list`
- `POST /trash/api/restore/:id`

## 9. Quy tắc dữ liệu quan trọng

### 9.1 Trả góp

- `status_code/status_text`: trạng thái nghiệp vụ của hợp đồng
- `collection_interval_days`: số ngày mỗi kỳ
- `collection_progress`: danh sách kỳ đã đóng
- `paid_before`: tổng số tiền đã đóng tương ứng các kỳ
- `payment_day`: ngày phải đóng của kỳ chưa đóng tiếp theo

### 9.2 Shop scope

- Admin hoặc user có `canAccessAllShops = true`:
  - xem toàn bộ
- User thường:
  - chỉ xem trong `shopId` hiện tại hoặc `allowedShopIds`

## 10. Điểm mạnh của logic hiện tại

- Phân quyền tách rõ theo:
  - đăng nhập
  - module
  - admin
  - phạm vi cửa hàng
- Có audit log đầy đủ
- Có cơ chế thùng rác để khôi phục
- Có import Excel và chuẩn hóa dữ liệu
- Có tính lịch đóng tiền theo kỳ
- Có cảnh báo đến hạn/quá hạn theo kỳ chưa đóng tiếp theo

## 11. Điểm cần lưu ý vận hành

- Một số text trong code còn lỗi encoding cũ
- Hệ thống vừa dùng dữ liệu local, vừa dùng remote 2gold.biz
- Khi đổi logic trả góp, cần kiểm tra đồng thời:
  - list API
  - dashboard
  - detail modal
  - bulk status
  - progress update

## 12. Đề xuất tài liệu tiếp theo

Nếu cần, có thể tách tiếp thành 3 file riêng:

- `docs/use-case-chi-tiet.md`
- `docs/so-do-luong-nghiep-vu.md`
- `docs/erd-va-data-dictionary.md`

## 13. ERD Mermaid

```mermaid
erDiagram
    INSTALLMENTS {
        int id PK
        int stt
        int shop_id FK
        string shop_name
        string loan_date
        string loan_date_display
        string customer_ref
        string customer_code
        string customer_name
        string imei
        int loan_package
        int revenue
        int setup_fee
        int net_disbursement
        int paid_before
        string payment_day
        int loan_days
        int installment_amount
        string note
        string installer_name
        int referral_fee
        string mc
        int status_code
        string status_text
        string payment_method
        int collection_interval_days
        int prepaid_period_count
        string collection_progress
        int source_row
        string created_at
        string updated_at
    }

    INSTALLMENT_IMPORTS {
        int id PK
        string file_name
        string sheet_name
        int shop_id FK
        string shop_name
        int row_count
        int skipped_rows
        string imported_at
        string normalization_logs
    }

    SHOPS {
        int id PK
        string name
        string phone
        string address
        string province_code
        string district_code
        string ward_code
        int status
        string note
        string created_at
        string updated_at
    }

    STAFF {
        int id PK
        int shop_id FK
        string shop_name
        string username
        string password_hash
        string full_name
        string phone
        string role
        int status
        boolean can_access_all_shops
        string allowed_shop_ids
        string module_permissions
        string created_at
        string updated_at
    }

    AUDIT_LOGS {
        int id PK
        string module_name
        string action_type
        string entity_type
        string entity_id
        int shop_id FK
        string shop_name
        int actor_user_id
        string actor_username
        string actor_display_name
        string actor_role
        string method
        string path
        string ip_address
        string description
        string metadata_json
        string created_at
    }

    TRASH_ITEMS {
        int id PK
        string entity_type
        int entity_id
        string label
        string payload_json
        string metadata_json
        string deleted_by
        string deleted_at
        string restored_at
    }

    ONLINE_USERS {
        string session_id PK
        int user_id
        string username
        string touched_at
    }

    SHOPS ||--o{ INSTALLMENTS : "contains"
    SHOPS ||--o{ STAFF : "assigns"
    SHOPS ||--o{ INSTALLMENT_IMPORTS : "receives"
    SHOPS ||--o{ AUDIT_LOGS : "scopes"
    STAFF ||--o{ AUDIT_LOGS : "acts"
```

### 13.1 Ghi chú quan hệ

- `SHOPS -> INSTALLMENTS`: một cửa hàng có nhiều hợp đồng trả góp.
- `SHOPS -> STAFF`: một cửa hàng có nhiều nhân viên.
- `SHOPS -> INSTALLMENT_IMPORTS`: mỗi lần import Excel gắn với một cửa hàng đích.
- `SHOPS -> AUDIT_LOGS`: log có thể gắn theo phạm vi cửa hàng.
- `STAFF -> AUDIT_LOGS`: nhân viên là tác nhân thực hiện thao tác.

### 13.2 Ghi chú thiết kế dữ liệu

- `allowed_shop_ids`, `module_permissions`, `collection_progress`, `normalization_logs`, `metadata_json`, `payload_json` hiện là dữ liệu dạng chuỗi JSON.
- `INSTALLMENTS.shop_name`, `STAFF.shop_name`, `INSTALLMENT_IMPORTS.shop_name` là dữ liệu dư thừa có chủ đích để hiển thị nhanh và lưu snapshot theo thời điểm.
- `TRASH_ITEMS` không ràng buộc FK cứng vì mục tiêu là giữ snapshot kể cả khi dữ liệu gốc đã bị xóa.
- `ONLINE_USERS` là dữ liệu runtime phục vụ thống kê người dùng online.
