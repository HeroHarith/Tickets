import { Share2, Facebook, Twitter, Linkedin, Link2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface SocialShareProps {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
}

export function SocialShare({ title, description, url, imageUrl }: SocialShareProps) {
  // Get encoded URL for sharing
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = description ? encodeURIComponent(description) : '';
  
  // Social media share URLs
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
  
  // Handle share click
  const handleShareClick = (platform: string, shareUrl: string) => {
    // Open share dialog
    window.open(shareUrl, '_blank', 'width=600,height=400');
    
    // Track the share with our API
    const eventId = extractEventIdFromUrl(url);
    if (eventId) {
      fetch(`/api/events/${eventId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platform: platform.toLowerCase() })
      }).then(response => {
        if (!response.ok) {
          throw new Error('Failed to record share');
        }
        return response.json();
      }).catch(err => {
        console.error('Failed to record share:', err);
      });
    }
  };
  
  // Extract event ID from URL
  const extractEventIdFromUrl = (url: string): number | null => {
    // Match pattern like /events/123 or /events/123?query=value
    const match = url.match(/\/events\/(\d+)(?:\?|$)/);
    return match ? parseInt(match[1]) : null;
  };
  
  // Copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link copied!",
        description: "Event link has been copied to clipboard",
        variant: "default",
      });
      
      // Track the copy as a share with our API
      const eventId = extractEventIdFromUrl(url);
      if (eventId) {
        fetch(`/api/events/${eventId}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ platform: 'copy_link' })
        }).then(response => {
          if (!response.ok) {
            throw new Error('Failed to record share');
          }
          return response.json();
        }).catch(err => {
          console.error('Failed to record share:', err);
        });
      }
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        title: "Copy failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleShareClick('Facebook', facebookShareUrl)}>
            <Facebook className="h-4 w-4 mr-2 text-blue-600" />
            <span>Facebook</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShareClick('Twitter', twitterShareUrl)}>
            <Twitter className="h-4 w-4 mr-2 text-sky-500" />
            <span>Twitter</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShareClick('LinkedIn', linkedinShareUrl)}>
            <Linkedin className="h-4 w-4 mr-2 text-blue-700" />
            <span>LinkedIn</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShareClick('WhatsApp', whatsappShareUrl)}>
            <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
            <span>WhatsApp</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyToClipboard}>
            <Link2 className="h-4 w-4 mr-2" />
            <span>Copy Link</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default SocialShare;