import { useParams } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { MyProfile } from "@/features/profile/MyProfile";
import { PersonProfile } from "@/features/profile/PersonProfile";

/**
 * One handle, and the two pages it can open.
 *
 * The app keeps these apart as two screens — `profile.dart` for my own account
 * and `person.dart` for somebody else's — and the split is not cosmetic: the
 * page about me carries the privacy pill, the four counts with their taps, the
 * way in to Insights, my Memories with the card that makes one, and the three
 * floating buttons. None of that belongs on a stranger's page.
 *
 * The branch is made on the handle rather than on the payload, so the first
 * frame of my own page is my own page rather than somebody's copy of it: a
 * skeleton in the shape of a stranger's profile that then turns into mine is a
 * page that was briefly about the wrong person.
 */
export function ProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();

  if (user && username && username === user.username) return <MyProfile />;
  return <PersonProfile />;
}
