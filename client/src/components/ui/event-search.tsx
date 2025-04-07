import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  EVENT_CATEGORIES, 
  EVENT_DATE_FILTERS, 
  EVENT_PRICE_FILTERS, 
  EVENT_TYPES,
  EVENT_POPULARITY_FILTERS,
  EVENT_TAGS
} from "@shared/schema";
import { 
  Search, SlidersIcon, CalendarIcon, MapPinIcon, TagIcon, 
  ArrowDownAZ, ArrowUpAZ, XCircle, Star, TicketIcon,
  Clock, TrendingUp, Users, Filter, Globe, MapPin, Layers
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface EventSearchProps {
  onSearch: (params: {
    search: string;
    category: string;
    eventType?: string;
    dateFilter?: string;
    priceFilter?: string;
    popularityFilter?: string;
    minDate?: string;
    maxDate?: string;
    location?: string;
    radiusMiles?: number;
    tags?: string[];
    sortBy?: string;
  }) => void;
}

const EventSearch = ({ onSearch }: EventSearchProps) => {
  const [searchParams, setSearchParams] = useState({
    search: "",
    category: "",
    eventType: "",
    dateFilter: "",
    priceFilter: "",
    popularityFilter: "",
    minDate: "",
    maxDate: "",
    location: "",
    radiusMiles: 25, // Default radius of 25 miles
    tags: [] as string[],
    sortBy: "date-desc" // Default sort
  });

  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [maxDate, setMaxDate] = useState<Date | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  
  // Count active filters whenever searchParams changes
  useEffect(() => {
    let count = 0;
    if (searchParams.category) count++;
    if (searchParams.eventType) count++;
    if (searchParams.dateFilter) count++;
    if (searchParams.priceFilter) count++;
    if (searchParams.popularityFilter) count++;
    if (searchParams.minDate || searchParams.maxDate) count++;
    if (searchParams.location) count++;
    if (searchParams.tags.length > 0) count++;
    setActiveFiltersCount(count);
  }, [searchParams]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearchParams({
      ...searchParams,
      [e.target.name]: e.target.value,
    });
  };

  const handleCategoryChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      category: value === "all-categories" ? "" : value,
    });
  };

  const handleDateFilterChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      dateFilter: value === "all" ? "" : value,
    });
  };

  const handlePriceFilterChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      priceFilter: value === "all" ? "" : value,
    });
  };

  const handleSortByChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      sortBy: value,
    });
  };

  const handleMinDateChange = (date: Date | undefined) => {
    setMinDate(date);
    setSearchParams({
      ...searchParams,
      minDate: date ? date.toISOString() : "",
    });
  };

  const handleMaxDateChange = (date: Date | undefined) => {
    setMaxDate(date);
    setSearchParams({
      ...searchParams,
      maxDate: date ? date.toISOString() : "",
    });
  };

  const handleClearDates = () => {
    setMinDate(undefined);
    setMaxDate(undefined);
    setSearchParams({
      ...searchParams,
      minDate: "",
      maxDate: "",
    });
  };
  
  const handleEventTypeChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      eventType: value === "all" ? "" : value,
    });
  };
  
  const handlePopularityFilterChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      popularityFilter: value === "all" ? "" : value,
    });
  };
  
  const handleRadiusChange = (value: number[]) => {
    setSearchParams({
      ...searchParams,
      radiusMiles: value[0],
    });
  };
  
  const handleTagToggle = (tag: string) => {
    const updatedTags = searchParams.tags.includes(tag)
      ? searchParams.tags.filter(t => t !== tag)
      : [...searchParams.tags, tag];
      
    setSearchParams({
      ...searchParams,
      tags: updatedTags,
    });
  };
  
  const clearAllFilters = () => {
    setMinDate(undefined);
    setMaxDate(undefined);
    setSearchParams({
      search: searchParams.search, // Keep the search term
      category: "",
      eventType: "",
      dateFilter: "",
      priceFilter: "",
      popularityFilter: "",
      minDate: "",
      maxDate: "",
      location: "",
      radiusMiles: 25,
      tags: [],
      sortBy: "date-desc"
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-poppins text-gray-900 mb-6">
          Find Your Next Experience
        </h1>
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Basic search row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-grow">
              <Input
                type="text"
                name="search"
                placeholder="Search for events..."
                value={searchParams.search}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                value={searchParams.category || "all-categories"}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">All Categories</SelectItem>
                  {EVENT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select
                value={searchParams.dateFilter || "all"}
                onValueChange={handleDateFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-weekend">This Weekend</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="future">Future Events</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                type="submit"
                className="w-full md:w-auto bg-primary text-white hover:bg-primary/90"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
          
          {/* Advanced filters toggle */}
          <div className="pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="text-gray-600"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Filters
              <SlidersIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          {/* Active filters display */}
          {activeFiltersCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-500 font-medium">Active Filters:</span>
              
              {searchParams.category && (
                <Badge variant="outline" className="flex items-center gap-1 bg-purple-50">
                  <span>Category: {searchParams.category}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => handleCategoryChange("all-categories")} 
                  />
                </Badge>
              )}
              
              {searchParams.eventType && (
                <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                  <span>Type: {searchParams.eventType}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => handleEventTypeChange("all")} 
                  />
                </Badge>
              )}
              
              {searchParams.dateFilter && (
                <Badge variant="outline" className="flex items-center gap-1 bg-green-50">
                  <span>{searchParams.dateFilter.replace(/-/g, ' ')}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => handleDateFilterChange("all")} 
                  />
                </Badge>
              )}
              
              {searchParams.priceFilter && (
                <Badge variant="outline" className="flex items-center gap-1 bg-amber-50">
                  <span>Price: {searchParams.priceFilter.replace(/-/g, ' ')}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => handlePriceFilterChange("all")} 
                  />
                </Badge>
              )}
              
              {searchParams.popularityFilter && (
                <Badge variant="outline" className="flex items-center gap-1 bg-pink-50">
                  <span>{searchParams.popularityFilter.replace(/-/g, ' ')}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => handlePopularityFilterChange("all")} 
                  />
                </Badge>
              )}
              
              {(searchParams.minDate || searchParams.maxDate) && (
                <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                  <span>Custom dates</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={handleClearDates} 
                  />
                </Badge>
              )}
              
              {searchParams.location && (
                <Badge variant="outline" className="flex items-center gap-1 bg-teal-50">
                  <span>Location: {searchParams.location}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => setSearchParams({...searchParams, location: ""})} 
                  />
                </Badge>
              )}
              
              {searchParams.tags.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1 bg-indigo-50">
                  <span>Tags: {searchParams.tags.length}</span>
                  <XCircle 
                    className="h-3.5 w-3.5 cursor-pointer" 
                    onClick={() => setSearchParams({...searchParams, tags: []})} 
                  />
                </Badge>
              )}
              
              {activeFiltersCount > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="ml-auto text-xs bg-white"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
          
          {/* Advanced filters section */}
          {isAdvancedOpen && (
            <div className="bg-gray-50 p-6 rounded-md mt-4">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Advanced Filters</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="text-xs"
                >
                  Reset All
                </Button>
              </div>
              
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="location">Location</TabsTrigger>
                  <TabsTrigger value="event-type">Event Type</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Price Filter */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <TagIcon className="h-4 w-4 mr-2" />
                          Price Range
                        </h3>
                        <RadioGroup
                          value={searchParams.priceFilter || "all"}
                          onValueChange={handlePriceFilterChange}
                          className="space-y-1"
                        >
                          <div className="flex items-center">
                            <RadioGroupItem value="all" id="price-all" />
                            <Label htmlFor="price-all" className="ml-2 cursor-pointer">Any Price</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="free" id="price-free" />
                            <Label htmlFor="price-free" className="ml-2 cursor-pointer">Free</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="under-25" id="price-under-25" />
                            <Label htmlFor="price-under-25" className="ml-2 cursor-pointer">Under $25</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="25-to-50" id="price-25-50" />
                            <Label htmlFor="price-25-50" className="ml-2 cursor-pointer">$25 to $50</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="50-to-100" id="price-50-100" />
                            <Label htmlFor="price-50-100" className="ml-2 cursor-pointer">$50 to $100</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="over-100" id="price-over-100" />
                            <Label htmlFor="price-over-100" className="ml-2 cursor-pointer">Over $100</Label>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>
                    
                    {/* Date Range Picker */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Date Range
                        </h3>
                        <div className="space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {minDate ? format(minDate, "PPP") : "Start Date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={minDate}
                                onSelect={handleMinDateChange}
                                disabled={(date) => maxDate ? date > maxDate : false}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {maxDate ? format(maxDate, "PPP") : "End Date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={maxDate}
                                onSelect={handleMaxDateChange}
                                disabled={(date) => minDate ? date < minDate : false}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          
                          {(minDate || maxDate) && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleClearDates}
                              className="text-xs"
                            >
                              Clear Dates
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Popularity Filter */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Popularity
                        </h3>
                        <RadioGroup
                          value={searchParams.popularityFilter || "all"}
                          onValueChange={handlePopularityFilterChange}
                          className="space-y-1"
                        >
                          <div className="flex items-center">
                            <RadioGroupItem value="all" id="popularity-all" />
                            <Label htmlFor="popularity-all" className="ml-2 cursor-pointer">All Events</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="trending" id="popularity-trending" />
                            <Label htmlFor="popularity-trending" className="ml-2 cursor-pointer">Trending Now</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="most-tickets-sold" id="popularity-most-sold" />
                            <Label htmlFor="popularity-most-sold" className="ml-2 cursor-pointer">Most Tickets Sold</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="newest" id="popularity-newest" />
                            <Label htmlFor="popularity-newest" className="ml-2 cursor-pointer">Recently Added</Label>
                          </div>
                          <div className="flex items-center">
                            <RadioGroupItem value="ending-soon" id="popularity-ending-soon" />
                            <Label htmlFor="popularity-ending-soon" className="ml-2 cursor-pointer">Ending Soon</Label>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="location" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Location Search */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <MapPinIcon className="h-4 w-4 mr-2" />
                          Location
                        </h3>
                        <Input
                          type="text"
                          name="location"
                          placeholder="Enter a city or venue"
                          value={searchParams.location}
                          onChange={handleInputChange}
                        />
                        
                        <div className="mt-4">
                          <h4 className="text-xs font-medium text-gray-500 mb-2">Radius (miles)</h4>
                          <div className="flex items-center space-x-4">
                            <Slider 
                              value={[searchParams.radiusMiles]} 
                              onValueChange={handleRadiusChange} 
                              max={100} 
                              step={5}
                            />
                            <span className="text-sm text-gray-700 min-w-[40px] text-right">
                              {searchParams.radiusMiles} mi
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Sort Options */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          {searchParams.sortBy?.includes('asc') ? (
                            <ArrowUpAZ className="h-4 w-4 mr-2" />
                          ) : (
                            <ArrowDownAZ className="h-4 w-4 mr-2" />
                          )}
                          Sort Results By
                        </h3>
                        <Select
                          value={searchParams.sortBy}
                          onValueChange={handleSortByChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sort by..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                            <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                            <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                            <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                            <SelectItem value="popularity-desc">Popularity (Most Popular)</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="event-type" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Event Type Selection */}
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <Layers className="h-4 w-4 mr-2" />
                          Event Type
                        </h3>
                        <RadioGroup
                          value={searchParams.eventType || "all"}
                          onValueChange={handleEventTypeChange}
                          className="space-y-1"
                        >
                          <div className="flex items-center">
                            <RadioGroupItem value="all" id="type-all" />
                            <Label htmlFor="type-all" className="ml-2 cursor-pointer">All Types</Label>
                          </div>
                          {EVENT_TYPES.map((type) => (
                            <div key={type} className="flex items-center">
                              <RadioGroupItem value={type} id={`type-${type}`} />
                              <Label htmlFor={`type-${type}`} className="ml-2 cursor-pointer capitalize">
                                {type}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="tags" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <TagIcon className="h-4 w-4 mr-2" />
                        Event Tags
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Select tags to further refine your search results
                      </p>
                      
                      <ScrollArea className="h-[200px] pr-4">
                        <div className="flex flex-wrap gap-2">
                          {EVENT_TAGS.map((tag) => {
                            const isSelected = searchParams.tags.includes(tag);
                            return (
                              <Badge
                                key={tag}
                                variant={isSelected ? "default" : "outline"}
                                className={`cursor-pointer ${
                                  isSelected 
                                    ? "bg-primary text-white hover:bg-primary/90" 
                                    : "bg-white hover:bg-gray-100"
                                }`}
                                onClick={() => handleTagToggle(tag)}
                              >
                                {tag.replace(/-/g, ' ')}
                                {isSelected && (
                                  <XCircle className="ml-1 h-3 w-3" />
                                )}
                              </Badge>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      
                      {searchParams.tags.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">
                              {searchParams.tags.length} tag{searchParams.tags.length !== 1 ? 's' : ''} selected
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchParams({...searchParams, tags: []})}
                              className="text-xs text-gray-500"
                            >
                              Clear All Tags
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EventSearch;
