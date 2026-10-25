import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./app.css";
import { Shell } from "./components/shell";
import { SnapshotProvider, useSnapshot } from "./lib/snapshot";
import { ClassPage } from "./routes/class";
import { Driver } from "./routes/driver";
import { Friends } from "./routes/friends";
import { LastRuns, Reruns } from "./routes/last";
import { Me } from "./routes/me";
import { More, Status } from "./routes/more";
import { Overall } from "./routes/overall";
import { Picker } from "./routes/picker";

// Friends are stored per event; remount when the event changes.
function FriendsForEvent() {
  return <Friends key={useSnapshot().snap!.eventKey} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SnapshotProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Picker />} />
            <Route path="me" element={<Me />} />
            <Route path="class" element={<ClassPage />} />
            <Route path="overall" element={<Overall />} />
            <Route path="friends" element={<FriendsForEvent />} />
            <Route path="last" element={<LastRuns />} />
            <Route path="reruns" element={<Reruns />} />
            <Route path="driver/:id" element={<Driver />} />
            <Route path="more" element={<More />} />
            <Route path="status" element={<Status />} />
            <Route path="*" element={<Overall />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SnapshotProvider>
  </StrictMode>,
);
