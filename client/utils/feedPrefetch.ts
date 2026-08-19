import axios from "../context/axiosConfig";
import { getSeenPostIds } from "./feedSession";
import { prefetchPostImages } from "./imageWarm";

// Kicked off during auth bootstrap so the first feed request is already in
// flight (usually finished) by the time the home screen mounts.
let inflight: Promise<any> | null = null;

export const prefetchFeed = () => {
  inflight = getSeenPostIds()
    .then((seenIds) => axios.post("/post/smart-feed?page=1&limit=10", { seenIds }))
    .then((res) => {
      // Start pulling the photos down the moment the payload lands, rather than
      // waiting for the home screen to mount and render the rows first. On a
      // cold start this is usually a second or more of head start.
      if (res?.data?.success) prefetchPostImages(res.data.posts || []);
      return res;
    })
    .catch(() => null);
};

export const takePrefetchedFeed = () => {
  const p = inflight;
  inflight = null;
  return p;
};
