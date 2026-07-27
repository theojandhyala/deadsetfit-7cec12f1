import { callRpc } from "./rpc-client";

export interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  difficulty: number;
  instructions: string;
  pro_tip: string;
  youtube_query: string;
  warmup_note: string;
  stretch_note: string;
  is_compound: boolean;
}

export const listExercises = ({
  data,
}: {
  data: {
    category?: string;
    equipment?: string;
    muscle?: string;
    difficulty?: number;
    search?: string;
    limit?: number;
  };
}) => callRpc<{ exercises: LibraryExercise[] }>("listExercises", data);

export const countExercises = () => callRpc<{ count: number }>("countExercises");
