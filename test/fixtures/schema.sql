PRAGMA foreign_key = ON;
CREATE TABLE IF NOT EXISTS 'events' (
	id		INTEGER PRIMARY KEY AUTOINCREMENT,
	event_name	VARCHAR(40) NOT NULL,
        event_date	DATE NOT NULL,
        num_runs	INTEGER NOT NULL,
        mirrored        BOOLEAN NOT NULL,
        unique_numbers  BOOLEAN NOT NULL,
        org_name        VARCHAR(40) NOT NULL,
        timing_mode     INTEGER NOT NULL,
        typical_time    FLOAT NOT NULL,
        web_active      BOOLEAN NOT NULL,
        run_timestamp   INTEGER
        );

CREATE TABLE IF NOT EXISTS 'drivers' (
	id	 	INTEGER	PRIMARY KEY AUTOINCREMENT,
        last_name	VARCHAR(30) NOT NULL,
        first_name	VARCHAR(30) NOT NULL,
	number		VARCHAR(6) NOT NULL,
        class_id	INTEGER NOT NULL,
        paxmult_id      INTEGER NOT NULL,
        car_model	VARCHAR(40),
        car_color	VARCHAR(20),
        member_num      VARCHAR(30),
        sponsor         VARCHAR(40),
        tire            VARCHAR(40),
        email		VARCHAR(60),
        cellphone	VARCHAR(20),
        member		BOOLEAN,
        registered	BOOLEAN,
        icon_color	VARCHAR(20),
        FOREIGN KEY (class_id)      REFERENCES classes ON UPDATE RESTRICT ON DELETE RESTRICT,
        FOREIGN KEY (paxmult_id)     REFERENCES classes ON UPDATE RESTRICT ON DELETE RESTRICT
        );
CREATE INDEX IF NOT EXISTS 'idx_drivers_number' on 'drivers' ( number );
CREATE INDEX IF NOT EXISTS 'idx_drivers_class_id' on 'drivers' ( class_id );
CREATE INDEX IF NOT EXISTS 'idx_drivers_last_name' on 'drivers' ( last_name );
CREATE INDEX IF NOT EXISTS 'idx_drivers_first_name' on 'drivers' ( first_name );

CREATE TABLE IF NOT EXISTS 'classes' (
        id		INTEGER PRIMARY KEY AUTOINCREMENT,
        class_name	VARCHAR(20) NOT NULL UNIQUE,
        paxed_class     BOOLEAN DEFAULT 0 NOT NULL,
        pax		FLOAT DEFAULT "1.0" NOT NULL,
        run_timestamp   INTEGER
        );
CREATE INDEX IF NOT EXISTS 'idx_classes_class_name' on 'classes' ( class_name );

CREATE TABLE IF NOT EXISTS 'registrations' (
        driver_id       INTEGER NOT NULL,
        event_id        INTEGER NOT NULL,
        bestcommittedrun_id	INTEGER,
        bestcommittedrun_no     INTEGER,
        bestpendingrun_id       INTEGER,
        run_timestamp           INTEGER,
        FOREIGN KEY (driver_id)     REFERENCES drivers ON UPDATE RESTRICT ON DELETE RESTRICT,
        FOREIGN KEY (event_id)      REFERENCES events ON UPDATE RESTRICT ON DELETE RESTRICT,
        FOREIGN KEY (bestcommittedrun_id)   REFERENCES runs ON UPDATE RESTRICT ON DELETE RESTRICT,
        FOREIGN KEY (bestpendingrun_id)     REFERENCES runs ON UPDATE RESTRICT ON DELETE RESTRICT
        );
CREATE INDEX IF NOT EXISTS 'idx_registrations_driver_id' on 'registrations' ( driver_id );
CREATE INDEX IF NOT EXISTS 'idx_registrations_event_id' on 'registrations' ( event_id );

CREATE TABLE IF NOT EXISTS 'runs' (
	id		INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id	INTEGER NOT NULL,
        driver_id	INTEGER NOT NULL,
        start_at	INTEGER,
        finish_at	INTEGER,
	start_tick	INTEGER,
	finish_tick	INTEGER,
	cones		INTEGER,
        disposition	VARCHAR(10),
        status		INTEGER NOT NULL,
        FOREIGN KEY (event_id)      REFERENCES events ON UPDATE RESTRICT ON DELETE RESTRICT,
        FOREIGN KEY (driver_id)     REFERENCES drivers ON UPDATE RESTRICT ON DELETE RESTRICT
	);
CREATE INDEX IF NOT EXISTS 'idx_runs_driver_id' on 'runs' ( driver_id );
CREATE INDEX IF NOT EXISTS 'idx_runs_event_id' on 'runs' ( event_id );
