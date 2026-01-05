# Herbarium Pro Backend

Python FastAPI backend with MySQL database and local file storage.

## Prerequisites

- Python 3.10 or higher
- MySQL 8.0 or higher
- pip (Python package manager)

## Setup Instructions

### 1. Install MySQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

**macOS (with Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Windows:**
Download and install from [MySQL Downloads](https://dev.mysql.com/downloads/installer/)

### 2. Create Database

Run the SQL setup script:
```bash
mysql -u root -p < setup_database.sql
```

Or manually:
```bash
mysql -u root -p
```

Then in MySQL shell:
```sql
CREATE DATABASE herbarium_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'herbarium_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON herbarium_db.* TO 'herbarium_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file by copying the example:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=herbarium_db
DB_USER=herbarium_user
DB_PASSWORD=your_secure_password

JWT_SECRET=your_jwt_secret_key_generate_a_random_string
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp
```

**Generate a secure JWT secret:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 5. Create Upload Directory

```bash
mkdir -p uploads/specimens
```

### 6. Initialize Database Tables

The tables will be created automatically when you first run the application. Alternatively, you can manually create them:

```bash
python3 -c "from database import create_tables; create_tables()"
```

### 7. Run the Server

**Development mode (with auto-reload):**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Or using the main script:**
```bash
python3 main.py
```

**Production mode:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- Alternative Docs (ReDoc): http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Specimens
- `GET /api/specimens` - Get all specimens
- `GET /api/specimens/{id}` - Get single specimen
- `POST /api/specimens` - Create specimen (with image upload)
- `PUT /api/specimens/{id}` - Update specimen
- `DELETE /api/specimens/{id}` - Delete specimen

### Piles
- `GET /api/piles` - Get all piles
- `POST /api/piles` - Create pile
- `PUT /api/piles/{id}` - Update pile
- `DELETE /api/piles/{id}` - Delete pile
- `POST /api/piles/{pile_id}/specimens/{specimen_id}` - Add specimen to pile
- `DELETE /api/piles/{pile_id}/specimens/{specimen_id}` - Remove specimen from pile

### Annotations
- `POST /api/specimens/{id}/annotations` - Add annotation

## Testing the API

### Using cURL

**Register a user:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Create a specimen (with authentication):**
```bash
curl -X POST http://localhost:8000/api/specimens \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "scientific_name=Adiantum capillus-veneris" \
  -F "family=Pteridaceae" \
  -F "collector=John Doe" \
  -F "images=@/path/to/image.jpg"
```

### Using the Swagger UI

1. Open http://localhost:8000/docs in your browser
2. Click "Authorize" button
3. Register or login to get a token
4. Enter the token in the format: `Bearer YOUR_TOKEN`
5. Try out the endpoints interactively

## Project Structure

```
backend/
├── main.py              # FastAPI application and routes
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic schemas for validation
├── database.py          # Database configuration
├── auth.py              # Authentication utilities
├── storage.py           # File storage handler
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variables template
├── setup_database.sql   # MySQL setup script
├── README.md           # This file
└── uploads/            # Image storage directory
    └── specimens/      # Specimen images by ID
```

## Development

### Run with auto-reload:
```bash
uvicorn main:app --reload
```

### Check database schema:
```bash
mysql -u herbarium_user -p herbarium_db -e "SHOW TABLES;"
```

### View API logs:
The logs will appear in the terminal where you ran uvicorn.

## Troubleshooting

**Problem: "Access denied for user"**
- Check your MySQL credentials in `.env`
- Ensure the user has proper privileges

**Problem: "Can't connect to MySQL server"**
- Ensure MySQL is running: `sudo systemctl status mysql`
- Check the host and port in `.env`

**Problem: "File too large" error**
- Increase `MAX_FILE_SIZE` in `.env`
- Current limit: 10MB per image

**Problem: Images not showing**
- Check that `uploads` directory exists and has write permissions
- Verify `CORS_ORIGINS` includes your frontend URL

## Production Deployment

### Using systemd (Linux)

Create `/etc/systemd/system/herbarium-api.service`:
```ini
[Unit]
Description=Herbarium Pro API
After=network.target mysql.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable herbarium-api
sudo systemctl start herbarium-api
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t herbarium-api .
docker run -p 8000:8000 --env-file .env herbarium-api
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads {
        alias /path/to/backend/uploads;
    }
}
```

## Security Considerations

1. **Change default passwords** in `.env`
2. **Generate strong JWT secret** (use `secrets.token_urlsafe(32)`)
3. **Use HTTPS** in production
4. **Enable firewall** and restrict MySQL access
5. **Regular backups** of database and uploads directory
6. **Update dependencies** regularly: `pip install --upgrade -r requirements.txt`

## Backup

**Database:**
```bash
mysqldump -u herbarium_user -p herbarium_db > backup_$(date +%Y%m%d).sql
```

**Images:**
```bash
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## License

See main project LICENSE file.
