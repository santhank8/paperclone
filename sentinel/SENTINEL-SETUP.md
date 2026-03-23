# SENTINEL — Setup & Deploy Guide

## Quick Start

### 1. VPS'e Script'leri Kopyala

```bash
# M4'ten VPS'e kopyala
ssh vps "mkdir -p /home/nail/sentinel/{scripts,logs}"
scp sentinel-scripts/*.sh vps:/home/nail/sentinel/scripts/
ssh vps "chmod +x /home/nail/sentinel/scripts/*.sh"
```

### 2. VPS Crontab Ayarla

```bash
ssh vps
crontab -e

# Aşağıdakileri ekle:
# SENTINEL - VPS Health Check (30 dk)
*/30 * * * * /home/nail/sentinel/scripts/vps-healthcheck.sh >> /home/nail/sentinel/logs/cron.log 2>&1

# SENTINEL - Scraper Gap Check (10 dk)
*/10 * * * * /home/nail/sentinel/scripts/scraper-check.sh >> /home/nail/sentinel/logs/cron.log 2>&1

# SENTINEL - Docker Cleanup (Pazar 03:00)
0 3 * * 0 docker system prune -f >> /home/nail/sentinel/logs/cleanup.log 2>&1

# SENTINEL - Log Rotation (günlük)
0 0 * * * find /home/nail/sentinel/logs -name "*.log" -size +50M -exec truncate -s 0 {} \;
```

### 3. n8n Webhook Oluştur

n8n'de yeni workflow:

1. **Webhook Trigger:** `POST /webhook/sentinel-alert`
2. **Switch Node:** severity'ye göre
   - `critical` → WhatsApp + Linear ticket
   - `warning` → sadece log
3. **WhatsApp Node (Evolution API):**
   ```json
   {
     "number": "YOUR_WHATSAPP",
     "text": "🚨 SENTINEL ALERT\nMachine: {{$json.machine}}\nSeverity: {{$json.severity}}\nFinding: {{$json.finding}}\nTime: {{$json.timestamp}}"
   }
   ```
4. **Linear Node (opsiyonel):** Auto-create issue for P0 alerts

### 4. macOS'ta Spotlight Kapat (Devrelerin)

Her iki Mac'te de çalıştır:

```bash
# Dev klasörlerinde Spotlight kapat
sudo mdutil -i off ~/Developer
sudo mdutil -i off ~/Projects
sudo mdutil -i off ~/.npm
sudo mdutil -i off ~/node_modules
sudo mdutil -i off ~/Library/Caches

# UI overhead azalt
defaults write com.apple.universalaccess reduceMotion -bool true
defaults write com.apple.universalaccess reduceTransparency -bool true
```

### 5. Paperclip'e Agent Ekle

`SENTINEL-SOUL.md` dosyasını Paperclip'in agent klasörüne kopyala:

```bash
cp SENTINEL-SOUL.md ~/paperclip/agents/sentinel/SOUL.md
cp SENTINEL-HEARTBEAT.md ~/paperclip/agents/sentinel/HEARTBEAT.md
```

### 6. T570 Kurulum (Linux ise)

```bash
# lm-sensors kur (termal izleme)
sudo apt install -y lm-sensors sysstat iotop
sudo sensors-detect --auto

# Tailscale kur (eğer yoksa)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

---

## Claude Code ile Kullanım

### Hızlı Komutlar

```bash
# Tüm fleet'i kontrol et
claude "SENTINEL: Run full fleet diagnostic. SSH to VPS, check local Mac, report."

# Sadece VPS kontrol
claude "SENTINEL: SSH to VPS and run the full diagnostic script. Analyze results."

# Sadece Mac kontrol
claude "SENTINEL: Run local macOS diagnostic. Check memory pressure, swap, node processes, thermals."

# Donma anında
claude "SENTINEL: FREEZE DETECTED. Run emergency capture, identify root cause, give kill commands."

# Scraper kontrolü
claude "SENTINEL: Check all 7 GPS scraper gaps. Which providers are behind?"
```

### Claude Code CLAUDE.md'ye Ekle

```markdown
## SENTINEL Agent
When I say "SENTINEL" or ask about system health:
1. Read ~/paperclip/agents/sentinel/SOUL.md for full protocol
2. Run appropriate diagnostic commands
3. Analyze with the SENTINEL analysis framework
4. Report in the standard SENTINEL output format
5. Alert via webhook if critical
```

---

## Dosya Yapısı

```
~/paperclip/agents/sentinel/
├── SOUL.md              # Agent ana prompt'u (bu dosya)
├── HEARTBEAT.md         # Schedule & checklist
└── adapters/
    └── claude-code.md   # Claude Code specific instructions

/home/nail/sentinel/     # VPS'te
├── scripts/
│   ├── vps-healthcheck.sh
│   └── scraper-check.sh
└── logs/
    ├── health.log
    ├── scraper.log
    ├── cron.log
    └── cleanup.log
```

---

## Test Et

```bash
# VPS healthcheck test
ssh vps "/home/nail/sentinel/scripts/vps-healthcheck.sh"

# Scraper check test
ssh vps "/home/nail/sentinel/scripts/scraper-check.sh"

# Webhook test
curl -X POST "https://nail.n8n.evohaus.org/webhook/sentinel-alert" \
  -H "Content-Type: application/json" \
  -d '{"type":"test","machine":"test","severity":"info","finding":"SENTINEL test alert","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```
