import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  Radio,
  Square,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureMotion } from "@/hooks/use-feature-motion";

export type MeetingParticipant = { id: string; name: string };
export type MeetingTask = { task_id: string; title: string; status: string };
export type MeetingAnalysisResult = {
  task_id: string;
  previous_status: string;
  new_status: string;
  reply_text: string;
  classification: {
    intent: string;
    confidence: number;
    blocker: string | null;
    reasoning: string;
  };
  unblock_nudge?: { sent: boolean; targetOwnerName: string; targetTaskId: string } | null;
};

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  resultIndex: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type RecognitionConstructor = new () => Recognition;

function NoteList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
        {icon}
        {title}
      </div>
      {items.length ? (
        items.map((item, index) => (
          <p
            key={`${item}-${index}`}
            className="mt-2 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-300"
          >
            {item}
          </p>
        ))
      ) : (
        <p className="mt-2 text-xs text-slate-500">None identified.</p>
      )}
    </div>
  );
}

export function LiveMeetingIntelligence({
  participants,
  tasks,
  onAnalyze,
}: {
  participants: MeetingParticipant[];
  tasks: MeetingTask[];
  onAnalyze: (taskId: string, transcript: string) => Promise<MeetingAnalysisResult>;
}) {
  const motionRef = useFeatureMotion<HTMLElement>();
  const [state, setState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [transcript, setTranscript] = useState("");
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.task_id ?? "");
  const [result, setResult] = useState<MeetingAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const captureActiveRef = useRef(false);
  const transcriptBeforeSessionRef = useRef("");

  useEffect(() => {
    return () => {
      captureActiveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already be stopped during unmount.
      }
      recognitionRef.current = null;
    };
  }, []);

  function getRecognitionConstructor() {
    const browserWindow = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
  }

  async function startCapture() {
    setError(null);
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      setError(
        "Live speech recognition is not available in this browser. You can paste a transcript instead.",
      );
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        setState("idle");
        setError(
          "Microphone permission was denied or no microphone is available. You can paste a transcript instead.",
        );
        return;
      }
    }

    const recognition = new Constructor();
    const baseTranscript = transcript.trim();
    transcriptBeforeSessionRef.current = baseTranscript;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const spokenText = event.results[index]?.[0]?.transcript.trim() ?? "";
        if (event.results[index]?.isFinal) finalText += `${spokenText} `;
        else interimText += `${spokenText} `;
      }
      const nextText = `${transcriptBeforeSessionRef.current} ${finalText} ${interimText}`.trim();
      if (nextText) setTranscript(nextText);
      if (finalText.trim())
        transcriptBeforeSessionRef.current =
          `${transcriptBeforeSessionRef.current} ${finalText}`.trim();
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        setState("recording");
        setError("No speech detected yet. Keep speaking; your existing transcript is preserved.");
        return;
      }
      captureActiveRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped after an error.
      }
      setState("idle");
      const message =
        event.error === "network"
          ? "The browser speech service is unavailable. Try Chrome or Edge with an internet connection, or paste a transcript."
          : event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Microphone permission was denied. Allow microphone access, then try again."
            : `Speech capture error: ${event.error}. Your transcript was preserved.`;
      setError(message);
    };
    recognition.onend = () => {
      if (captureActiveRef.current) {
        try {
          recognition.start();
        } catch {
          // Some browsers emit onend while a restart is already pending.
        }
      }
    };

    recognitionRef.current = recognition;
    captureActiveRef.current = true;
    try {
      recognition.start();
      setState("recording");
    } catch {
      captureActiveRef.current = false;
      setState("idle");
      setError("The microphone session could not start. Check browser permissions and try again.");
    }
  }

  function pauseCapture() {
    captureActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    setTranscript(transcriptBeforeSessionRef.current || transcript);
    setState("paused");
  }

  function stopCapture() {
    captureActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    setTranscript(transcriptBeforeSessionRef.current || transcript);
    setState("stopped");
  }

  async function analyzeTranscript() {
    if (!selectedTask || !transcript.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await onAnalyze(selectedTask, transcript.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meeting analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      ref={motionRef}
      className="feature-motion rounded-2xl border border-purple-500/30 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-md sm:p-6"
    >
      <div data-feature-reveal className="flex flex-wrap items-start justify-between gap-4">
        <div data-feature-reveal>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">
            <Sparkles className="h-3.5 w-3.5" /> Live Meeting Intelligence
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Capture the conversation. Keep the commitments.
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Record with consent, review the transcript, and send confirmed discussion through the
            existing ReVenants classifier.
          </p>
        </div>
        <div
          data-feature-reveal
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${state === "recording" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}
        >
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {state === "recording" ? "Recording" : state}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div data-feature-reveal className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">Transcript</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Audio stays in this browser; only the transcript is sent for analysis.
              </p>
            </div>
            <Mic
              className={`h-5 w-5 ${state === "recording" ? "animate-pulse text-rose-400" : "text-slate-500"}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {state === "recording" ? (
              <Button
                className="feature-motion-button"
                size="sm"
                variant="outline"
                onClick={pauseCapture}
              >
                <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
              </Button>
            ) : (
              <Button className="feature-motion-button" size="sm" onClick={startCapture}>
                <Play className="mr-1.5 h-3.5 w-3.5" />{" "}
                {state === "paused" ? "Resume" : "Start meeting"}
              </Button>
            )}
            {state === "recording" && (
              <Button
                className="feature-motion-button"
                size="sm"
                variant="outline"
                onClick={stopCapture}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
              </Button>
            )}
          </div>
          <textarea
            aria-label="Meeting transcript"
            className="mt-4 min-h-48 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500/40"
            placeholder="Your live transcript will appear here. You can also paste notes from another transcription service."
            value={transcript}
            onChange={(event) => {
              setTranscript(event.target.value);
              transcriptBeforeSessionRef.current = event.target.value;
            }}
          />
          {error && (
            <p
              aria-live="polite"
              className="mt-3 flex items-start gap-2 text-xs font-medium text-rose-300"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              aria-label="Task for transcript analysis"
              className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200"
              value={selectedTask}
              onChange={(event) => setSelectedTask(event.target.value)}
            >
              {tasks.map((task) => (
                <option key={task.task_id} value={task.task_id}>
                  {task.task_id} · {task.title}
                </option>
              ))}
            </select>
            <Button
              className="feature-motion-button"
              variant="secondary"
              onClick={analyzeTranscript}
              disabled={!selectedTask || !transcript.trim() || busy}
            >
              <Radio className="mr-2 h-4 w-4" /> {busy ? "Analyzing…" : "Analyze transcript"}
            </Button>
          </div>
        </div>

        <div data-feature-reveal className="rounded-xl border border-slate-800 bg-slate-950/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">Review workspace</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Results come from the primary project’s existing classifier and API.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-slate-500" />
          </div>
          {result ? (
            <div className="mt-4 space-y-4">
              <div
                data-feature-reveal
                className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="font-bold text-white">{result.task_id}</span>
                  <span className="text-slate-500">{result.previous_status}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-cyan-300">{result.new_status}</span>
                  <span className="ml-auto text-emerald-300">
                    {Math.round(result.classification.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="mt-2 leading-5 text-slate-300">{result.reply_text}</p>
              </div>
              <div data-feature-reveal className="grid gap-3 sm:grid-cols-2">
                <NoteList
                  title="Classification"
                  items={[result.classification.intent, result.classification.reasoning]}
                  icon={<Radio className="h-3.5 w-3.5 text-cyan-300" />}
                />
                <NoteList
                  title="Blocker"
                  items={result.classification.blocker ? [result.classification.blocker] : []}
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
              Analyze a transcript to populate the classifier result and blocker review.
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-300">Participants:</span>
            {participants.slice(0, 3).map((participant) => (
              <span key={participant.id} className="rounded-full bg-slate-800 px-2 py-1">
                {participant.name}
              </span>
            ))}
            <span className="ml-auto">Consent required</span>
          </div>
        </div>
      </div>
    </section>
  );
}
