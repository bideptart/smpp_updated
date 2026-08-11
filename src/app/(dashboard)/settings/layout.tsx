import SettingsSidebar from "@/components/layout/SettingsSidebar";
import TopBar from "@/components/layout/TopBar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <div className="settings-layout">
        <SettingsSidebar />
        <div className="settings-content">{children}</div>
      </div>
    </>
  );
}
