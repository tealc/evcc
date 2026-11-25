package api

import (
	"errors"
	"fmt"
	"slices"
	"time"
)

// AbsenceOccasions are the allowed absence occasions
var AbsenceOccasions = []string{"work", "school", "shopping", "sport", "visit", "trip", "vacation", "other"}

// Absence is a time window during which a vehicle is away and cannot be charged
type Absence struct {
	Id       string  `json:"id"`                 // client-generated id, unique per vehicle
	Active   bool    `json:"active"`             // active flag
	Occasion string  `json:"occasion"`           // see AbsenceOccasions
	Repeat   bool    `json:"repeat"`             // true = weekly, false = one-time
	Weekdays []int   `json:"weekdays,omitempty"` // repeat only, 0-6 (Sunday-Saturday)
	Start    string  `json:"start,omitempty"`    // repeat only, HH:MM
	End      string  `json:"end,omitempty"`      // repeat only, HH:MM, end <= start ends the next day
	From     string  `json:"from,omitempty"`     // one-time only, RFC3339
	To       string  `json:"to,omitempty"`       // one-time only, RFC3339
	Tz       string  `json:"tz"`                 // timezone in IANA format, used for repeat
	Energy   float64 `json:"energy"`             // expected energy used while away in kWh, 0 = unknown
}

// AbsenceInterval is a concrete occurrence of an absence
type AbsenceInterval struct {
	Start, End time.Time
	Energy     float64 // kWh
}

const absenceAlignment = 15 * time.Minute

// parseClock parses HH:MM and returns hour and minute
func parseClock(s string) (int, int, error) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid time: %q", s)
	}
	return t.Hour(), t.Minute(), nil
}

// Window returns the one-time absence window
func (a Absence) Window() (time.Time, time.Time, error) {
	from, err := time.Parse(time.RFC3339, a.From)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid from: %q", a.From)
	}
	to, err := time.Parse(time.RFC3339, a.To)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid to: %q", a.To)
	}
	return from, to, nil
}

// Expired returns true for one-time absences that ended before now
func (a Absence) Expired(now time.Time) bool {
	if a.Repeat {
		return false
	}
	_, to, err := a.Window()
	return err == nil && to.Before(now)
}

// Validate checks the absence for consistency
func (a Absence) Validate() error {
	if a.Id == "" {
		return errors.New("missing id")
	}

	if !slices.Contains(AbsenceOccasions, a.Occasion) {
		return fmt.Errorf("invalid occasion: %q", a.Occasion)
	}

	if a.Energy < 0 {
		return fmt.Errorf("invalid energy: %v", a.Energy)
	}

	if _, err := time.LoadLocation(a.Tz); err != nil {
		return fmt.Errorf("invalid timezone: %v", err)
	}

	if !a.Repeat {
		from, to, err := a.Window()
		if err != nil {
			return err
		}
		if from.Truncate(absenceAlignment) != from || to.Truncate(absenceAlignment) != to {
			return errors.New("from and to must be aligned to 15 minutes")
		}
		if !to.After(from) {
			return errors.New("to must be after from")
		}
		return nil
	}

	if len(a.Weekdays) == 0 {
		return errors.New("missing weekdays")
	}
	for _, day := range a.Weekdays {
		if day < 0 || day > 6 {
			return fmt.Errorf("weekday out of range: %v", day)
		}
	}

	for _, s := range []string{a.Start, a.End} {
		_, m, err := parseClock(s)
		if err != nil {
			return err
		}
		if m%15 != 0 {
			return fmt.Errorf("time must be aligned to 15 minutes: %q", s)
		}
	}

	return nil
}

// Intervals returns the occurrences of an active absence overlapping [from, to), sorted by start.
// Weekly occurrences are attributed to the weekday they start on and may extend into the next day.
func (a Absence) Intervals(from, to time.Time) []AbsenceInterval {
	if !a.Active || !to.After(from) {
		return nil
	}

	overlaps := func(s, e time.Time) bool {
		return e.After(from) && s.Before(to)
	}

	if !a.Repeat {
		s, e, err := a.Window()
		if err != nil || !e.After(s) || !overlaps(s, e) {
			return nil
		}
		return []AbsenceInterval{{Start: s, End: e, Energy: a.Energy}}
	}

	loc, err := time.LoadLocation(a.Tz)
	if err != nil {
		return nil
	}
	sh, sm, err := parseClock(a.Start)
	if err != nil {
		return nil
	}
	eh, em, err := parseClock(a.End)
	if err != nil {
		return nil
	}

	var res []AbsenceInterval

	// start one day early to catch an occurrence across midnight that started before from
	first := from.In(loc)
	last := to.In(loc)
	day := time.Date(first.Year(), first.Month(), first.Day()-1, 0, 0, 0, 0, loc)

	for !day.After(last) {
		if slices.Contains(a.Weekdays, int(day.Weekday())) {
			y, m, d := day.Date()
			s := time.Date(y, m, d, sh, sm, 0, 0, loc)
			e := time.Date(y, m, d, eh, em, 0, 0, loc)
			if !e.After(s) {
				e = time.Date(y, m, d+1, eh, em, 0, 0, loc)
			}
			if overlaps(s, e) {
				res = append(res, AbsenceInterval{Start: s, End: e, Energy: a.Energy})
			}
		}

		y, m, d := day.Date()
		day = time.Date(y, m, d+1, 0, 0, 0, 0, loc)
	}

	return res
}

// AbsenceIntervals returns the occurrences of all active absences overlapping [from, to), sorted by start
func AbsenceIntervals(absences []Absence, from, to time.Time) []AbsenceInterval {
	var res []AbsenceInterval
	for _, a := range absences {
		res = append(res, a.Intervals(from, to)...)
	}

	slices.SortStableFunc(res, func(a, b AbsenceInterval) int {
		return a.Start.Compare(b.Start)
	})

	return res
}
