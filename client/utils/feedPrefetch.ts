import axios from "../context/axiosConfig";
import { getSeenPostIds } from "./feedSession";

// Kicked off during auth bootstrap so the first feed request is already in
// flight (usually finished) by the time the home screen mounts.
let inflight: Promise<any> | null = null;

export const prefetchFeed = () => {
  inflight = getSeenPostIds()
    .then((seenIds) => axios.post("/post/smart-feed?page=1&limit=10", { seenIds }))
    .catch(() => null);
};

export const takePrefetchedFeed = () => {
  const p = inflight;
  inflight = null;
  return p;
};
