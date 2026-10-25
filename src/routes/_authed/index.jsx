import { createFileRoute } from "@tanstack/react-router";
import { StudioProvider, useStudio } from "@/components/studio/StudioProvider";
import { StudioShell } from "@/components/studio/StudioShell";
import { StepUpload } from "@/components/studio/StepUpload";
import { StepFiles } from "@/components/studio/StepFiles";
import { StepRepo } from "@/components/studio/StepRepo";
import { StepPush } from "@/components/studio/StepPush";
import { StepBuild } from "@/components/studio/StepBuild";
import { StepDeploy } from "@/components/studio/StepDeploy";
import { StepShip } from "@/components/studio/StepShip";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dev Style Studio — Build from your phone" },
      { name: "description", content: "Upload a project, push it to GitHub, build an APK and ship a live site." },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <StudioProvider>
      <StudioContent />
    </StudioProvider>
  );
}

function StudioContent() {
  const { step, project } = useStudio();
  const isAndroid = project?.info?.type === "android";

  return (
    <StudioShell>
      {step === 0 && <StepUpload />}
      {step === 1 && <StepFiles />}
      {step === 2 && <StepRepo />}
      {step === 3 && <StepPush />}
      {step === 4 && (isAndroid ? <StepBuild /> : <StepDeploy />)}
      {step === 5 && <StepShip />}
    </StudioShell>
  );
}