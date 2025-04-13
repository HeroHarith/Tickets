import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Facebook, Twitter, Instagram } from "lucide-react";
import { Link } from "wouter";

const subscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const Footer = () => {
  const form = useForm<z.infer<typeof subscribeSchema>>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: z.infer<typeof subscribeSchema>) => {
    console.log("Subscription email:", data.email);
    // In a real app, this would call an API endpoint
    form.reset();
  };

  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase mb-4">
              About TicketHub
            </h3>
            <p className="text-base text-gray-600">
              The easiest way to create, sell, and manage tickets for your events.
            </p>
            <div className="flex space-x-6 mt-4">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-6 w-6" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-base text-gray-600 hover:text-gray-900">
                  Browse Events
                </Link>
              </li>
              <li>
                <Link href="/create-event" className="text-base text-gray-600 hover:text-gray-900">
                  Sell Tickets
                </Link>
              </li>
              <li>
                <Link href="/my-tickets" className="text-base text-gray-600 hover:text-gray-900">
                  My Tickets
                </Link>
              </li>
              <li>
                <Link href="/managed-events" className="text-base text-gray-600 hover:text-gray-900">
                  Managed Events
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 tracking-wider uppercase mb-4">
              Stay Updated
            </h3>
            <p className="text-base text-gray-600 mb-4">
              Get the latest updates on events and special promotions.
            </p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="sm:flex">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="w-full sm:max-w-xs">
                      <FormControl>
                        <Input
                          placeholder="Enter your email"
                          type="email"
                          {...field}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="mt-3 rounded-md sm:mt-0 sm:ml-3 sm:flex-shrink-0">
                  <Button
                    type="submit"
                    className="w-full bg-primary border border-transparent rounded-md py-2 px-4 flex items-center justify-center text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    Subscribe
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
        
        <div className="mt-8 border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between">
          <p className="text-base text-gray-400">
            &copy; {new Date().getFullYear()} TicketHub. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
export default Footer;
