import { redirect } from "next/navigation";

export default function WorkspacePage() {
  redirect("/settings/workspace/users");
}
