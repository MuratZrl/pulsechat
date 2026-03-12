export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image?: string;
  domain: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

const mockPreviews: Record<string, Omit<LinkPreviewData, "url">> = {
  "github.com": {
    title: "GitHub: Let's build from here",
    description: "GitHub is where over 100 million developers shape the future of software.",
    domain: "github.com",
    image: "#24292e",
  },
  "google.com": {
    title: "Google",
    description: "Search the world's information, including webpages, images, videos and more.",
    domain: "google.com",
    image: "#4285f4",
  },
  "youtube.com": {
    title: "YouTube",
    description: "Enjoy the videos and music you love, upload original content, and share it all.",
    domain: "youtube.com",
    image: "#ff0000",
  },
  "twitter.com": {
    title: "X (formerly Twitter)",
    description: "From breaking news and entertainment to sports and politics, get the full story.",
    domain: "twitter.com",
    image: "#1da1f2",
  },
  "stackoverflow.com": {
    title: "Stack Overflow",
    description: "Where developers learn, share, & build careers. The largest online community for programmers.",
    domain: "stackoverflow.com",
    image: "#f48024",
  },
  "reddit.com": {
    title: "Reddit - Dive into anything",
    description: "Reddit is a network of communities where people can dive into their interests and hobbies.",
    domain: "reddit.com",
    image: "#ff4500",
  },
};

export function getLinkPreview(url: string): LinkPreviewData {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");

    // Check for known domains
    for (const [domain, preview] of Object.entries(mockPreviews)) {
      if (hostname.includes(domain)) {
        return { ...preview, url };
      }
    }

    // Generate mock preview from domain
    const domainName = hostname.split(".")[0];
    const capitalizedName = domainName.charAt(0).toUpperCase() + domainName.slice(1);

    return {
      url,
      title: `${capitalizedName} - Website`,
      description: `Visit ${capitalizedName} for more information and content.`,
      domain: hostname,
      image: "#6366f1",
    };
  } catch {
    return {
      url,
      title: "Link",
      description: url,
      domain: url,
    };
  }
}
