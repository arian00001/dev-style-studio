package com.devstyle.studio;

/** One GitHub repository row. */
public class Repo {

  public final long id;
  public final String owner;
  public final String name;
  public final String branch;
  public final boolean isPrivate;
  public final String updated;

  public Repo(long id, String owner, String name, String branch, boolean isPrivate, String updated) {
    this.id = id;
    this.owner = owner;
    this.name = name;
    this.branch = branch;
    this.isPrivate = isPrivate;
    this.updated = updated;
  }

  public String fullName() {
    return owner + "/" + name;
  }
}