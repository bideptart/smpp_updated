"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  Maximize2,
  Minimize2,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VendorConn {
  id: number;
  name: string;
  companyName: string;
  host: string | null;
  port: number | null;
  systemId: string | null;
  bound: boolean;
  msgsSent: number;
  msgsDelivered: number;
  msgsFailed: number;
}


export default function VendorLivePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "status">("name");
  const [fullscreen, setFullscreen] = useState(false);

  const { data, mutate } = useSWR(
    "/api/connections/vendor-status",
    fetcher,
    { refreshInterval: autoRefresh ? 10000 : 0 }
  );

  const daemon = data?.daemon || { running: false, uptime: 0 };
  const connections: VendorConn[] = data?.connections || [];

  const filtered = connections
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortField === "status") return (b.bound ? 1 : 0) - (a.bound ? 1 : 0);
      return a.name.localeCompare(b.name);
    });

  const connectedCount = connections.filter((c) => c.bound).length;
  const disconnectedCount = connections.filter((c) => !c.bound).length;

  return (
    <>
      <TopBar title="Vendor Connection Connectivity" />
      <div className={`page-content ${fullscreen ? "live-fullscreen" : ""}`}>
        <PageBreadcrumb crumbs={[{ label: "Connections" }, { label: "Vendor Live" }]} />
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
            {daemon.running && (
              <div className="live-stat live-stat--info">
                Daemon uptime: {Math.floor(daemon.uptime / 60)}m
              </div>
            )}
          </div>
          <div className="live-header-actions">
            <div className="conn-search-wrap">
              <Search className="conn-search-icon" />
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="conn-search-input"
              />
            </div>
            <div className="filter-auto-refresh">
              <Switch id="vendor-auto" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="vendor-auto" className="filter-auto-label">Auto</Label>
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
                    Vendor <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="live-th">V. Type</th>
                <th className="live-th">Endpoint</th>
                <th className="live-th">
                  <button className="live-sort-btn" onClick={() => setSortField("status")}>
                    Status <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="live-th">Binds</th>
                <th className="live-th">Sent / Dlv / Fail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="live-empty">No vendor connections</td></tr>
              )}
              {filtered.map((conn) => (
                <tr key={conn.id} className={`live-row ${conn.bound ? "live-row--connected" : "live-row--disconnected"}`}>
                  <td className="live-td">
                    <div className="live-name">{conn.name}</div>
                    <div className="live-company">{conn.companyName}</div>
                  </td>
                  <td className="live-td">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">SMPP</Badge>
                  </td>
                  <td className="live-td live-td--mono">
                    {conn.host || "—"}:{conn.port || "—"}
                  </td>
                  <td className="live-td">
                    <span className={`live-status ${conn.bound ? "live-status--connected" : "live-status--disconnected"}`}>
                      {conn.bound ? "Connected" : "Disconnected"}
                    </span>
                  </td>
                  <td className="live-td live-td--center">{conn.bound ? 1 : 0}</td>
                  <td className="live-td">
                    <span className="live-counter live-counter--sent">{conn.msgsSent}</span>
                    {" / "}
                    <span className="live-counter live-counter--dlv">{conn.msgsDelivered}</span>
                    {" / "}
                    <span className="live-counter live-counter--fail">{conn.msgsFailed}</span>
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
