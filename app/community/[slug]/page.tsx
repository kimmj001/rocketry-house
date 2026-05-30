import { CommunityPostDetail } from "@/components/community-post-detail";
import { communityPosts, getCommunityPost } from "@/lib/community-data";

export function generateStaticParams() {
  return communityPosts.map((post) => ({ slug: post.slug }));
}

export default async function CommunityPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getCommunityPost(slug);
  const related = communityPosts.filter((item) => item.slug !== slug).slice(0, 4);

  return <CommunityPostDetail slug={slug} initialPost={post} related={related} />;
}
