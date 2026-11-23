# ERD TiketAman

```mermaid
erDiagram
  USERS ||--o| WALLETS : "punya"
  USERS ||--o{ EVENTS : "membuat (organizer)"
  USERS ||--o{ ORDERS : "memesan"
  EVENTS ||--o{ ORDERS : "dipesan"
  ORDERS ||--o{ TICKETS : "menghasilkan"
  EVENTS ||--o{ TICKETS : "memiliki"
  USERS ||--o{ TICKETS : "memiliki"
  TICKETS ||--o{ RESALE_LISTINGS : "dijual ulang"
  TICKETS ||--o| CHECKINS : "dipakai"
  ORDERS ||--o{ PAYMENT_NOTIFICATIONS : "dilaporkan lewat midtrans_order_id"

  USERS { int id PK
    string email UK
    string nim_hash UK
    string role }
  WALLETS { int id PK
    int user_id FK
    string address UK
    string encrypted_key }
  EVENTS { int id PK
    int organizer_id FK
    int face_value_idr
    int capacity
    int max_per_user
    int max_resale_bps
    int onchain_event_id }
  ORDERS { int id PK
    int user_id FK
    int event_id FK
    int listing_id FK
    string midtrans_order_id UK
    string status }
  TICKETS { int id PK
    int order_id FK
    int event_id FK
    int owner_user_id FK
    int token_id UK
    string status }
  RESALE_LISTINGS { int id PK
    int ticket_id FK
    int seller_user_id FK
    int price_idr
    string status }
  PAYMENT_NOTIFICATIONS { int id PK
    string midtrans_order_id
    string transaction_status
    int signature_valid }
  CHECKINS { int id PK
    int ticket_id FK_UK
    string tx_hash }
```

Skema SQL lengkap: `backend/db/schema.sql`.

Catatan: `payment_notifications` terhubung ke `orders` lewat kolom `midtrans_order_id` (bukan foreign key), supaya notifikasi tetap tercatat walau order tidak ditemukan.
