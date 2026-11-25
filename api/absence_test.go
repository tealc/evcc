package api

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAbsenceIntervals(t *testing.T) {
	loc, err := time.LoadLocation("Europe/Berlin")
	require.NoError(t, err)

	at := func(day, hour, minute int) time.Time {
		return time.Date(2026, 11, day, hour, minute, 0, 0, loc)
	}

	// Monday noon until Wednesday noon
	from, to := at(23, 12, 0), at(25, 12, 0)

	weekly := func(weekdays []int, start, end string) Absence {
		return Absence{Id: "a", Active: true, Occasion: "work", Repeat: true, Weekdays: weekdays, Start: start, End: end, Tz: "Europe/Berlin", Energy: 5}
	}
	once := func(from, to time.Time) Absence {
		return Absence{Id: "b", Active: true, Occasion: "trip", From: from.Format(time.RFC3339), To: to.Format(time.RFC3339), Tz: "Europe/Berlin", Energy: 20}
	}

	for _, tc := range []struct {
		name    string
		absence Absence
		res     []AbsenceInterval
	}{
		{"workdays", weekly([]int{1, 2, 3, 4, 5}, "07:30", "17:15"), []AbsenceInterval{
			{at(23, 7, 30), at(23, 17, 15), 5}, // started before from
			{at(24, 7, 30), at(24, 17, 15), 5},
			{at(25, 7, 30), at(25, 17, 15), 5}, // ends after to
		}},
		{"over midnight", weekly([]int{1}, "22:00", "06:00"), []AbsenceInterval{
			{at(23, 22, 0), at(24, 6, 0), 5},
		}},
		{"over midnight from previous day", weekly([]int{0}, "20:00", "14:00"), []AbsenceInterval{
			{at(22, 20, 0), at(23, 14, 0), 5},
		}},
		{"over midnight ended before from", weekly([]int{0}, "22:00", "06:00"), nil},
		{"equal start and end is a full day", weekly([]int{2}, "08:00", "08:00"), []AbsenceInterval{
			{at(24, 8, 0), at(25, 8, 0), 5},
		}},
		{"other weekday", weekly([]int{4}, "08:00", "09:00"), nil},
		{"inactive", func() Absence { a := weekly([]int{1, 2, 3}, "07:30", "17:15"); a.Active = false; return a }(), nil},
		{"one-time", once(at(24, 8, 0), at(27, 18, 0)), []AbsenceInterval{
			{at(24, 8, 0), at(27, 18, 0), 20},
		}},
		{"one-time before", once(at(20, 8, 0), at(23, 12, 0)), nil},
		{"one-time after", once(at(25, 12, 0), at(27, 18, 0)), nil},
		{"one-time inactive", func() Absence { a := once(at(24, 8, 0), at(27, 18, 0)); a.Active = false; return a }(), nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			res := tc.absence.Intervals(from, to)
			require.Len(t, res, len(tc.res))
			for i := range res {
				assert.True(t, tc.res[i].Start.Equal(res[i].Start), "start %d: %v != %v", i, tc.res[i].Start, res[i].Start)
				assert.True(t, tc.res[i].End.Equal(res[i].End), "end %d: %v != %v", i, tc.res[i].End, res[i].End)
				assert.Equal(t, tc.res[i].Energy, res[i].Energy)
			}
		})
	}

	// combined intervals are sorted by start
	res := AbsenceIntervals([]Absence{once(at(24, 8, 0), at(24, 9, 0)), weekly([]int{1}, "22:00", "06:00")}, from, to)
	require.Len(t, res, 2)
	assert.True(t, res[0].Start.Equal(at(23, 22, 0)))
	assert.True(t, res[1].Start.Equal(at(24, 8, 0)))
}

func TestAbsenceIntervalsDST(t *testing.T) {
	loc, err := time.LoadLocation("Europe/Berlin")
	require.NoError(t, err)

	// the night of the change to summer time is an hour shorter
	a := Absence{Active: true, Repeat: true, Weekdays: []int{6}, Start: "22:00", End: "06:00", Tz: "Europe/Berlin"}
	res := a.Intervals(time.Date(2026, 3, 28, 12, 0, 0, 0, loc), time.Date(2026, 3, 29, 12, 0, 0, 0, loc))
	require.Len(t, res, 1)
	assert.Equal(t, 7*time.Hour, res[0].End.Sub(res[0].Start))
}

func TestAbsenceValidate(t *testing.T) {
	valid := func() Absence {
		return Absence{Id: "a", Active: true, Occasion: "work", Repeat: true, Weekdays: []int{1, 5}, Start: "07:30", End: "17:15", Tz: "Europe/Berlin"}
	}
	once := func() Absence {
		return Absence{Id: "b", Occasion: "vacation", From: "2026-12-24T08:00:00+01:00", To: "2026-12-27T18:00:00+01:00", Tz: "Europe/Berlin", Energy: 12.5}
	}

	for _, tc := range []struct {
		name  string
		mod   func(*Absence)
		base  func() Absence
		valid bool
	}{
		{"repeat", func(*Absence) {}, valid, true},
		{"one-time", func(*Absence) {}, once, true},
		{"over midnight", func(a *Absence) { a.Start, a.End = "22:00", "06:00" }, valid, true},
		{"missing id", func(a *Absence) { a.Id = "" }, valid, false},
		{"invalid occasion", func(a *Absence) { a.Occasion = "party" }, valid, false},
		{"negative energy", func(a *Absence) { a.Energy = -1 }, valid, false},
		{"invalid timezone", func(a *Absence) { a.Tz = "Mars/Olympus" }, valid, false},
		{"no weekdays", func(a *Absence) { a.Weekdays = nil }, valid, false},
		{"weekday out of range", func(a *Absence) { a.Weekdays = []int{7} }, valid, false},
		{"negative weekday", func(a *Absence) { a.Weekdays = []int{-1} }, valid, false},
		{"invalid start", func(a *Absence) { a.Start = "7:3" }, valid, false},
		{"unaligned start", func(a *Absence) { a.Start = "07:20" }, valid, false},
		{"unaligned end", func(a *Absence) { a.End = "17:01" }, valid, false},
		{"missing end", func(a *Absence) { a.End = "" }, valid, false},
		{"invalid from", func(a *Absence) { a.From = "tomorrow" }, once, false},
		{"unaligned from", func(a *Absence) { a.From = "2026-12-24T08:05:00+01:00" }, once, false},
		{"unaligned to", func(a *Absence) { a.To = "2026-12-27T18:00:30+01:00" }, once, false},
		{"to before from", func(a *Absence) { a.From, a.To = a.To, a.From }, once, false},
		{"to equals from", func(a *Absence) { a.To = a.From }, once, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := tc.base()
			tc.mod(&a)
			assert.Equal(t, tc.valid, a.Validate() == nil, a.Validate())
		})
	}
}

func TestAbsenceExpired(t *testing.T) {
	now := time.Date(2026, 12, 28, 0, 0, 0, 0, time.UTC)

	assert.True(t, Absence{From: "2026-12-24T08:00:00+01:00", To: "2026-12-27T18:00:00+01:00"}.Expired(now))
	assert.False(t, Absence{From: "2026-12-24T08:00:00+01:00", To: "2026-12-29T18:00:00+01:00"}.Expired(now))
	assert.False(t, Absence{Repeat: true}.Expired(now))
}
