export interface Subject {
  id: string;
  name: string;
  icon: string;
}

export const SUBJECTS: Subject[] = [
  { id: "intermediate", name: "중급회계", icon: "📊" },
  { id: "advanced", name: "고급회계", icon: "📈" },
  { id: "tax", name: "세무회계", icon: "🧾" },
  { id: "finance", name: "재무관리", icon: "💹" },
  { id: "economics", name: "경제학", icon: "🏛️" },
];
