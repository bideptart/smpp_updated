# SMSLocal BSS v2 - UI Redesign Context

## Project Location
- **Local:** `C:\Users\SMS\Desktop\International Platform\v2-smslocal-bss\`
- **VPS:** `/var/www/v2-smslocal-bss/` on `187.127.150.132`
- **Live URL:** http://v2.app.smslocal.com
- **Login:** admin / Admin@123

## Tech Stack
- Next.js 16.2.3 (App Router) + React 19 + TypeScript
- PostgreSQL 16 + Prisma 6.19.3
- Tailwind CSS v4 + shadcn/ui v4
- SWR for data fetching, Recharts for charts
- NextAuth v5 (beta) for authentication
- PM2 for process management on Ubuntu 24.04

## What's Working
- All pages render and are functional
- Database connected with real schema (11 tables)
- Auth (login/logout) works
- Dashboard with summary cards, filters, traffic table
- Send SMS page with compose form
- Companies CRUD, Connections CRUD, Routes CRUD
- Customer SMPP Accounts CRUD
- Customer Live Status + Reports pages
- SMPP Daemon (vendor connections) + SMPP Server (port 2775)
- Apache reverse proxy to Next.js port 3001
- Existing PHP app at v2.app.smslocal.in is untouched

## UI Problems to Fix

### Dashboard (`src/app/(dashboard)/page.tsx`)
1. Summary cards need better design - match the old PHP app style (colored left border, uppercase labels, large numbers, ASR% subtitle)
2. Filter dropdowns show raw values ("15") instead of labels ("Last 15 min")
3. Need section titles: "Traffic Summary by Company" and "Traffic Detail (Per Minute)"
4. Table needs better column headers (uppercase, bolder)
5. Total row needs to stand out more
6. Need a traffic chart (Recharts bar/area chart)
7. Too much whitespace - make it denser like a data platform

### Sidebar (`src/components/layout/Sidebar.tsx`)
8. Scrollbar visible and ugly - hide or style it
9. Overall looks OK but could be more polished

### Connection Status
10. Shows "active" even when vendor SMPP is not actually connected
11. Need real-time TCP connectivity check
12. Connection cards should show: green=connected, red=disconnected, gray=inactive

### General Design Reference
- The OLD PHP app at v2.app.smslocal.in has a good dashboard design to reference
- TextMagic (textmagic.com) for general clean SaaS aesthetic
- Dense data tables with colored percentage badges
- Professional telecom BSS look

## Key Files for UI Changes
- `src/app/(dashboard)/page.tsx` - Dashboard page
- `src/components/dashboard/SummaryCards.tsx` - KPI cards
- `src/components/dashboard/FilterBar.tsx` - Filters
- `src/components/dashboard/TrafficTable.tsx` - Traffic data table
- `src/components/dashboard/TrafficChart.tsx` - Chart
- `src/components/layout/Sidebar.tsx` - Navigation sidebar
- `src/components/layout/TopBar.tsx` - Top header bar
- `src/app/(dashboard)/connections/status/page.tsx` - Connection health
- `src/app/globals.css` - Global styles/theme

## Deployment Commands
After making changes locally:
```bash
# Upload changed files to VPS
scp -r src/ root@187.127.150.132:/var/www/v2-smslocal-bss/src/

# SSH into VPS and rebuild
ssh root@187.127.150.132
cd /var/www/v2-smslocal-bss
npm run build
pm2 restart smslocal-bss-web
```

## VPS Services (PM2)
```
pm2 status     - Check all services
pm2 logs       - View logs
pm2 restart all - Restart everything
```
- smslocal-bss-web (Next.js on port 3001)
- smpp-daemon (vendor SMPP connections)
- smpp-server (customer SMPP on port 2775)
