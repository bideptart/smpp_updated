"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CustomerConn {
  id: number;
  systemId: string;
  accountName: string | null;
  companyName: string;
  status: string;
  maxTps: number;
  bound: boolean;
  clientIp: string | null;
  connectedAt: string | null;
  lastActivity: string | null;
  msgCount: number;
  bindType: string;
  txRequests: number;
  txResponses: number;
  rxRequests: number;
  rxResponses: number;
  txRate: number;
  rxRate: number;
  queueSize: number;
}

function TxRxDisplay({ conn }: { conn: CustomerConn }) {
  return (
    <div className="live-txrx">
      <span className="live-txrx-label">TX:</span>
      <span className="live-txrx-detail">
        Q:{conn.queueSize}, REQ: {conn.txRequests} ({conn.txRate} m/s), RSP: {conn.txResponses}
      </span>
      <span className="live-txrx-sep">;</span>
      <span className="live-txrx-label">RX:</span>
      <span className="live-txrx-detail">
        Q:0, REQ: {conn.rxRequests} ({conn.rxRate} m/s), RSP: {conn.rxResponses}
      </span>
    </div>
  );
}

export default function CustomerLivePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "status">("name");
  const [fullscreen, setFullscreen] = useState(false);

  const { data, mutate } = useSWR(
    "/api/connections/customer-live",
    fetcher,
    { refreshInterval: autoRefresh ? 10000 : 0 }
  );

  const server = data?.server || { running: false, uptime: 0, listenPort: 2775 };
  const connections: CustomerConn[] = data?.connections || [];

  const filtered = connections
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.systemId.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortField === "status") return (b.bound ? 1 : 0) - (a.bound ? 1 : 0);
      return a.systemId.localeCompare(b.systemId);
    });

  const connectedCount = connections.filter((c) => c.bound).length;
  const disconnectedCount = connections.filter((c) => !c.bound).length;

  return (
    <>
      <TopBar title="Customer Connection Connectivity" />
      <div className={`page-content ${fullscreen ? "live-fullscreen" : ""}`}>
        {/* Header Bar */}
        <div className="live-header-bar">
          <div className="live-header-stats">
            <div className="live-stat live-stat--total">
              <Server className="h-4 w-4" />
              <strong>{connections.length}</strong> Total
            </div>
            <div className="live-stat live-stat--green">
              <Wifi className="h-4 w-4" />
              <strong>{connectedCount}</strong> Connected
            </div>
            <div className="live-stat live-stat--red">
              <WifiOff className="h-4 w-4" />
              <strong>{disconnectedCount}</strong> Disconnected
            </div>
            {server.running && (
              <div className="live-stat live-stat--info">
                Port: {server.listenPort} | Uptime: {Math.floor(server.uptime / 60)}m
              </div>
            )}
          </div>
          <div className="live-header-actions">
            <div className="conn-search-wrap">
              <Search className="conn-search-icon" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="conn-search-input"
              />
            </div>
            <div className="filter-auto-refresh">
              <Switch id="cust-auto" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="cust-auto" className="filter-auto-label">Auto</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="live-refresh-btn">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFullscreen(!fullscreen)} className="live-refresh-btn">
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="live-table-wrap">
          <table className="live-table">
            <thead>
              <tr>
                <th className="live-th">
                  <button className="live-sort-btn" onClick={() => setSortField("name")}>
                    Connection <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="live-th">
                  <button className="live-sort-btn" onClick={() => setSortField("status")}>
                    Status <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="live-th">IP Address</th>
                <th className="live-th">Binds</th>
                <th className="live-th">Conn Mode</th>
                <th className="live-th">Security</th>
                <th className="live-th">Messages</th>
                <th className="live-th">TX / RX</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="live-empty">
                  <div className="live-empty-content">
                    <Shield className="h-8 w-8 text-slate-300" />
                    <p>No customer SMPP accounts configured</p>
                    <p className="text-xs text-muted-foreground">Customers will appear when they bind to port {server.listenPort}</p>
                  </div>
                </td></tr>
              )}
              {filtered.map((conn) => (
                <tr key={conn.id} className={`live-row ${conn.bound ? "live-row--connected" : "live-row--disconnected"}`}>
                  <td className="live-td">
                    <div className="live-name">{conn.systemId}</div>
                    <div className="live-company">{conn.companyName}</div>
                  </td>
                  <td className="live-td">
                    <span className={`live-status ${conn.bound ? "live-status--connected" : "live-status--disconnected"}`}>
                      {conn.bound ? "Connected" : "Disconnected"}
                    </span>
                  </td>
                  <td className="live-td live-td--mono">{conn.clientIp || "—"}</td>
                  <td className="live-td live-td--center">{conn.bound ? 1 : 0}</td>
                  <td className="live-td">{conn.bindType}</td>
                  <td className="live-td">
                    <span className="live-security">
                      <Shield className="h-3.5 w-3.5 text-blue-500" />
                    </span>
                  </td>
                  <td className="live-td live-td--center">{conn.msgCount}</td>
                  <td className="live-td">
                    <TxRxDisplay conn={conn} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
