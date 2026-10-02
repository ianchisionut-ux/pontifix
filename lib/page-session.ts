import { cache } from "react";
import { auth } from "@/lib/auth";

// Nested App Router layouts can ask for the same session more than once.
// React cache deduplicates that work for the lifetime of the current request.
export const getPageSession = cache(auth);