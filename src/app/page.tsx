'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import { Clock, Search, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check } from 'lucide-react';
import type { Database, Enums } from '@/types/database.types';

type Volunteer = Database['public']['Tables']['volunteers']['Row'];
type Department = Database['public']['Enums']['departments'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

type VolunteerWithStatus = Volunteer & {
  status: AttendanceStatus | null;
};

export default function Home() {
  const supabase = createClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayDate, setTodayDate] = useState<string>('');
  const [todayDateId, setTodayDateId] = useState<string | null>(null);
  const [scheduledVolunteers, setScheduledVolunteers] = useState<
    Record<Department, VolunteerWithStatus[]>
  >({} as Record<Department, VolunteerWithStatus[]>);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVolunteers, setFilteredVolunteers] = useState<
    Record<Department, VolunteerWithStatus[]>
  >({} as Record<Department, VolunteerWithStatus[]>);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    scheduled: 0,
    departments: 0
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Filter volunteers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredVolunteers(scheduledVolunteers);
      return;
    }

    const filtered: Record<Department, VolunteerWithStatus[]> = {} as Record<
      Department,
      VolunteerWithStatus[]
    >;

    Object.entries(scheduledVolunteers).forEach(([dept, volunteers]) => {
      const filteredDeptVolunteers = volunteers.filter((volunteer) =>
        `${volunteer.first_name} ${volunteer.last_name}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );

      if (filteredDeptVolunteers.length > 0) {
        filtered[dept as Department] = filteredDeptVolunteers;
      }
    });

    setFilteredVolunteers(filtered);
  }, [searchQuery, scheduledVolunteers]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Format today's date in ISO format (YYYY-MM-DD)
      const today = new Date();
      const formattedDate = format(today, 'yyyy-MM-dd');

      // Try to fetch today's date record
      let { data: dateData, error: dateError } = await supabase
        .from('game_dates')
        .select('*')
        .eq('date', formattedDate)
        .eq('is_active', true)
        .single();

      // If no date for today, find the nearest future date
      if (dateError && dateError.code === 'PGRST116') {
        const { data: futureDate, error: futureDateError } = await supabase
          .from('game_dates')
          .select('*')
          .eq('is_active', true)
          .gt('date', formattedDate)
          .order('date', { ascending: true })
          .limit(1)
          .single();

        if (!futureDateError) {
          dateData = futureDate;
        } else {
          // If no future date, try to get the most recent past date
          const { data: pastDate, error: pastDateError } = await supabase
            .from('game_dates')
            .select('*')
            .eq('is_active', true)
            .lt('date', formattedDate)
            .order('date', { ascending: false })
            .limit(1)
            .single();

          if (!pastDateError) {
            dateData = pastDate;
          }
        }
      }

      if (dateData) {
        setTodayDate(dateData.date);
        setTodayDateId(dateData.id);

        // Fetch all volunteers
        const { data: volunteersData, error: volunteersError } = await supabase
          .from('volunteers')
          .select('*')
          .eq('is_active', true)
          .order('first_name');

        if (volunteersError) {
          console.error('Error fetching volunteers:', volunteersError);
          setLoading(false);
          return;
        }

        // Fetch volunteer statuses for the selected date
        const { data: statusData, error: statusError } = await supabase
          .from('volunteer_date_status')
          .select('*')
          .eq('date_id', dateData.id);

        if (statusError) {
          console.error('Error fetching volunteer statuses:', statusError);
          setLoading(false);
          return;
        }

        // Group volunteers by department and add status
        const byDepartment: Record<Department, VolunteerWithStatus[]> = {} as Record<
          Department,
          VolunteerWithStatus[]
        >;

        // First, get all scheduled volunteers for the date
        const scheduledVolunteerIds = statusData
          .filter((status) => status.status === 'scheduled' || status.status === 'present')
          .map((status) => status.volunteer_id);

        // Filter volunteers to only include those scheduled for the date
        const scheduledVolunteersData = volunteersData.filter((volunteer) =>
          scheduledVolunteerIds.includes(volunteer.id)
        );

        // Group by department
        scheduledVolunteersData.forEach((volunteer) => {
          const dept = (volunteer.department as Enums<'departments'>) || 'n/a';
          if (!byDepartment[dept]) {
            byDepartment[dept] = [];
          }

          // Find status for this volunteer
          const volunteerStatus = statusData.find((status) => status.volunteer_id === volunteer.id);

          byDepartment[dept].push({
            ...volunteer,
            status: volunteerStatus ? volunteerStatus.status : null
          });
        });

        setScheduledVolunteers(byDepartment);
        setFilteredVolunteers(byDepartment);

        // Calculate stats
        const totalVolunteers = scheduledVolunteersData.length;
        const presentVolunteers = statusData.filter((status) => status.status === 'present').length;
        const scheduledOnly = statusData.filter((status) => status.status === 'scheduled').length;
        const departmentCount = Object.keys(byDepartment).length;

        setStats({
          total: totalVolunteers,
          present: presentVolunteers,
          scheduled: scheduledOnly,
          departments: departmentCount
        });
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Format time for display
  const formatTime = (date: Date) => {
    return format(date, 'h:mm:ss a');
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <>
      <div className="bg-background absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] dark:bg-[radial-gradient(#171717_1px,transparent_1px)]" />
      <main className="container mx-auto mt-24 px-4 py-8 md:mt-16">
        <h1 className="mb-6 text-3xl font-bold">Volunteer Attendance Dashboard</h1>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Left Side - Current Time and Date Info */}
          <div className="space-y-6 md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Current Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold">{formatTime(currentTime)}</div>
                  <div className="text-muted-foreground mt-2">{formatDate(currentTime)}</div>

                  {todayDate && todayDate !== format(currentTime, 'yyyy-MM-dd') && (
                    <div className="mt-4 rounded-md bg-amber-100 p-2 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                      Showing schedule for {format(new Date(todayDate), 'EEEE, MMMM d, yyyy')}
                      <div className="text-xs">(No game scheduled for today)</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Attendance Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <div className="text-muted-foreground text-sm">Total Volunteers</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold">{stats.departments}</div>
                      <div className="text-muted-foreground text-sm">Departments</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.present}
                      </div>
                      <div className="text-muted-foreground text-sm">Present</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.scheduled}
                      </div>
                      <div className="text-muted-foreground text-sm">Scheduled</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      {stats.total > 0 && (
                        <div
                          className="absolute h-full bg-green-500"
                          style={{ width: `${(stats.present / stats.total) * 100}%` }}
                        ></div>
                      )}
                    </div>
                    <div className="mt-2 text-center text-sm">
                      {stats.total > 0
                        ? `${Math.round((stats.present / stats.total) * 100)}% Attendance Rate`
                        : 'No data available'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Scheduled Volunteers */}
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Scheduled Volunteers</CardTitle>
                <div className="relative w-64">
                  <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search volunteers..."
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-9 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
                  </div>
                ) : !todayDateId ? (
                  <div className="text-muted-foreground text-center">
                    No active game date for today
                  </div>
                ) : Object.keys(filteredVolunteers).length === 0 ? (
                  <div className="text-muted-foreground text-center">
                    {searchQuery
                      ? 'No volunteers match your search'
                      : 'No volunteers scheduled for today'}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(filteredVolunteers).map(([dept, volunteers]) => (
                      <div key={dept}>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-lg font-medium capitalize">{dept}</h3>
                          <Badge variant="outline">{volunteers.length}</Badge>
                        </div>
                        <div className="space-y-2">
                          {volunteers.map((volunteer) => (
                            <div
                              key={volunteer.id}
                              className={`flex items-center justify-between rounded-md border p-3 ${
                                volunteer.status === 'present' ? 'bg-primary/10' : 'opacity-70'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-medium">
                                  {volunteer.first_name} {volunteer.last_name}
                                </div>
                              </div>
                              <div>
                                {volunteer.status === 'present' ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    <Check className="mr-1 h-3 w-3" />
                                    Present
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Scheduled</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator className="mt-4" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
