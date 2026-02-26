import { useGoogleLogin } from "@react-oauth/google";
import { useYouTubeContext } from "../context/YouTubeContext";

/**
 * Renders a button that initiates Google OAuth for YouTube Analytics.
 * Must be inside both GoogleOAuthProvider and YouTubeProvider.
 */
export function YouTubeLoginButton({ onSuccess, ...props }) {
  const { setAccessToken } = useYouTubeContext();

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      onSuccess?.();
    },
    scope: "https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly",
  });

  return (
    <button type="button" className="ibtn primary" onClick={login} {...props}>
      Connect YouTube (OAuth)
    </button>
  );
}
