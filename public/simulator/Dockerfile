# Gunakan base image Python yang ringan
FROM python:3.9-slim

# Tetapkan direktori kerja di dalam container
WORKDIR /app

# Salin file requirements.txt terlebih dahulu untuk caching layer
# Ini mempercepat build jika dependensi tidak berubah
COPY requirements.txt .

# Instal dependensi Python
RUN pip install --no-cache-dir -r requirements.txt

# Salin skrip simulator ke dalam container
COPY device-simulator.py .

# Ekspos port yang digunakan oleh WebSocket server
EXPOSE 8765

# Perintah default untuk menjalankan simulator saat container dimulai
CMD ["python3", "device-simulator.py"]
