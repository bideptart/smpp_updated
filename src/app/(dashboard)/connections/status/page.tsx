"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  Search,
  Server,
  ArrowUpDown,
  Zap,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Connection {
  id: number;
  name: string;
  companyName: string;
  companyType: string;
  type: "SMPP" | "HTTP";
  direction: string;
  host: string | null;
  port: number | null;
  username: string | null;
  apiUrl: string | null;
  status: string;
  maxTps: number;
}

interface CheckResult {
  reachable: boolean;
  latency: number;
  detail: string;
  checkedAt: string;
}

type SortField = "name" | "status";

function StatusBadge({ result, isChecking }: { result?: CheckResult; isChecking: boolean }) {
  if (isChecking) {
    return <span className="conn-tbl-status conn-tbl-status--checking">Checking...</span>;
  }
  if (!result) {
    return <span className="conn-tbl-status conn-tbl-status--unchecked">Not checked</span>;
  }
  if (result.reachable) {
    return <span className="conn-tbl-status conn-tbl-status--connected">Connected</span>;
  }
  return <span className="conn-tbl-status conn-tbl-status--disconnected">Disconnected</span>;
}

export default function ConnectionStatusPage() {
  const { data } = useSWR("/api/connections", fetcher, { refreshInterval: 0 });
  const allConnections: Connection[] = data?.data || [];

  const [results, setResults] = useState<Record<number, CheckResult>>({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [vendorSort, setVendorSort] = useState<SortField>("name");
  const [customerSort, setCustomerSort] = useState<SortField>("name");

  // Split by company type
  const vendorConns = allConnections.filter((c) => {
    const match = c.companyType === "vendor" || c.direction === "MT" || c.direction === "BOTH";
    if (!match) return false;
    if (vendorSearch) {
      const q = vendorSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q);
    }
    return true;
  });

  const customerConns = allConnections.filter((c) => {
    const match = c.companyType === "customer" || c.direction === "MO";
    if (!match) return false;
    if (customerSearch) {
      const q = customerSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q);
    }
    return true;
  });

  // If no customer connections exist, show vendor connections that accept MO too
  const hasCustomerConns = allConnections.some((c) => c.companyType === "customer");

  const sortConns = (conns: Connection[], field: SortField) => {
    return [...conns].sort((a, b) => {
      if (field === "status") {
        const aStatus = results[a.id]?.reachable ? 1 : 0;
        const bStatus = results[b.id]?.reachable ? 1 : 0;
        return bStatus - aStatus;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const sortedVendors = sortConns(vendorConns, vendorSort);
  const sortedCustomers = sortConns(hasCustomerConns ? customerConns : [], customerSort);

  async function checkConnection(id: number) {
    setChecking((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/connections/${id}/check`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setResults((prev) => ({ ...prev, [id]: result.data }));
      }
    } catch {
      // silent
    } finally {
      setChecking((prev) => ({ ...prev, [id]: false }));
    }
  }

  const checkAll = useCallback(async () => {
    setCheckingAll(true);
    await Promise.allSettled(allConnections.map((c) => checkConnection(c.id)));
    setCheckingAll(false);
    toast.success("All connections checked");
  }, [allConnections]);

  const vendorConnected = vendorConns.filter((c) => results[c.id]?.reachable).length;
  const vendorDisconnected = Object.keys(results).length > 0
    ? vendorConns.filter((c) => results[c.id] && !results[c.id].reachable).length
    : 0;

  // Auto-refresh
  useSWR(
    autoRefresh ? "auto-check" : null,
    async () => {
      await Promise.allSettled(allConnections.map((c) => checkConnection(c.id)));
    },
    { refreshInterval: 30000 }
  );

  return (
    <>
      <TopBar title="Connection Live Status" />
      <div className="page-content">
        {/* Summary Bar */}
        <div className="conn-summary-bar">
          <div className="conn-summary-stats">
            <div className="conn-summary-stat">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="conn-summary-num">{allConnections.length}</span>
              <span className="conn-summary-label">Total</span>
            </div>
            <div className="conn-summary-stat conn-summary-stat--green">
              <Wifi className="h-4 w-4" />
              <span className="conn-summary-num">{vendorConnected}</span>
              <span className="conn-summary-label">Connected</span>
            </div>
            <div className="conn-summary-stat conn-summary-stat--red">
              <WifiOff className="h-4 w-4" />
              <span className="conn-summary-num">{vendorDisconnected}</span>
              <span className="conn-summary-label">Disconnected</span>
            </div>
          </div>
          <div className="conn-summary-actions">
            <div className="filter-auto-refresh">
              <Switch
                id="conn-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="conn-auto-refresh" className="filter-auto-label">
                Auto-refresh
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkAll}
              disabled={checkingAll}
              className="filter-refresh-btn"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checkingAll ? "animate-spin" : ""}`} />
              {checkingAll ? "Checking..." : "Check All"}
            </Button>
          </div>
        </div>

        {/* Dual Panel Layout */}
        <div className="conn-dual-panel">
          {/* Vendor Connections Table */}
          <div className="conn-panel">
            <div className="conn-panel-header">
              <h3 className="conn-panel-title">Vendor Connection Connectivity</h3>
              <div className="conn-panel-tools">
                <div className="conn-search-wrap">
                  <Search className="conn-search-icon" />
                  <Input
                    placeholder="Search vendors..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="conn-search-input"
                  />
                </div>
              </div>
            </div>
            <div className="conn-tbl-wrap">
              <table className="conn-tbl">
                <thead>
                  <tr>
                    <th className="conn-tbl-th">
                      <button className="conn-tbl-sort" onClick={() => setVendorSort("name")}>
                        Vendor <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="conn-tbl-th">Type</th>
                    <th className="conn-tbl-th">Endpoint</th>
                    <th className="conn-tbl-th">
                      <button className="conn-tbl-sort" onClick={() => setVendorSort("status")}>
                        Status <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="conn-tbl-th">Latency</th>
                    <th className="conn-tbl-th">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVendors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="conn-tbl-empty">No vendor connections found</td>
                    </tr>
                  )}
                  {sortedVendors.map((conn) => {
                    const result = results[conn.id];
                    const isChk = checking[conn.id];
                    const endpoint = conn.type === "SMPP"
                      ? `${conn.host || "—"}:${conn.port || "—"}`
                      : conn.apiUrl || "—";

                    return (
                      <tr key={conn.id} className={`conn-tbl-row ${result?.reachable ? "conn-tbl-row--ok" : result ? "conn-tbl-row--fail" : ""}`}>
                        <td className="conn-tbl-td">
                          <div className="conn-tbl-name">{conn.name}</div>
                          <div className="conn-tbl-company">{conn.companyName}</div>
                        </td>
                        <td className="conn-tbl-td">
                          <Badge className={conn.type === "SMPP" ? "bg-purple-100 text-purple-700 border-purple-200 text-[10px]" : "bg-blue-100 text-blue-700 border-blue-200 text-[10px]"}>
                            {conn.type}
                          </Badge>
                        </td>
                        <td className="conn-tbl-td conn-tbl-td--mono">{endpoint}</td>
                        <td className="conn-tbl-td">
                          <StatusBadge result={result} isChecking={!!isChk} />
                        </td>
                        <td className="conn-tbl-td">
                          {result ? (
                            <span className="conn-tbl-latency">
                              <Zap className="h-3 w-3 text-amber-500" />
                              {result.latency}ms
                            </span>
                          ) : "—"}
                        </td>
                        <td className="conn-tbl-td">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkConnection(conn.id)}
                            disabled={!!isChk}
                            className="conn-tbl-test-btn"
                          >
                            <Activity className={`h-3 w-3 ${isChk ? "animate-pulse" : ""}`} />
                            Test
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Connections Table */}
          <div className="conn-panel">
            <div className="conn-panel-header">
              <h3 className="conn-panel-title">Customer Connection Connectivity</h3>
              <div className="conn-panel-tools">
                <div className="conn-search-wrap">
                  <Search className="conn-search-icon" />
                  <Input
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="conn-search-input"
                  />
                </div>
              </div>
            </div>
            <div className="conn-tbl-wrap">
              <table className="conn-tbl">
                <thead>
                  <tr>
                    <th className="conn-tbl-th">
                      <button className="conn-tbl-sort" onClick={() => setCustomerSort("name")}>
                        Connection <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="conn-tbl-th">Type</th>
                    <th className="conn-tbl-th">
                      <button className="conn-tbl-sort" onClick={() => setCustomerSort("status")}>
                        Status <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="conn-tbl-th">Binds</th>
                    <th className="conn-tbl-th">Max TPS</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasCustomerConns && (
                    <tr>
                      <td colSpan={5} className="conn-tbl-empty">
                        <div className="conn-tbl-empty-content">
                          <Server className="h-8 w-8 text-slate-300" />
                          <p>No customer SMPP connections</p>
                          <p className="text-xs text-muted-foreground">Customer connections will appear here when customers bind to your SMPP server on port 2775</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedCustomers.map((conn) => {
                    const result = results[conn.id];
                    const isChk = checking[conn.id];
                    return (
                      <tr key={conn.id} className={`conn-tbl-row ${result?.reachable ? "conn-tbl-row--ok" : result ? "conn-tbl-row--fail" : ""}`}>
                        <td className="conn-tbl-td">
                          <div className="conn-tbl-name">{conn.name}</div>
                          <div className="conn-tbl-company">{conn.companyName}</div>
                        </td>
                        <td className="conn-tbl-td">
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                            {conn.type}
                          </Badge>
                        </td>
                        <td className="conn-tbl-td">
                          <StatusBadge result={result} isChecking={!!isChk} />
                        </td>
                        <td className="conn-tbl-td">1</td>
                        <td className="conn-tbl-td">{conn.maxTps || 10}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
