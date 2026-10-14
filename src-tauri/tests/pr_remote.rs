mod common;

use common::Repo;
use diffity_desktop_lib::core::git;

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|name| name.to_string()).collect()
}

#[test]
fn prefers_gh_default_then_upstream_then_origin() {
    let gh = "remote.fork.gh-resolved base\n";
    assert_eq!(git::choose_pr_remote(&names(&["origin", "fork", "upstream"]), gh).as_deref(), Some("fork"));
    assert_eq!(git::choose_pr_remote(&names(&["origin", "upstream"]), "").as_deref(), Some("upstream"));
    assert_eq!(git::choose_pr_remote(&names(&["origin"]), "").as_deref(), Some("origin"));
    assert_eq!(git::choose_pr_remote(&names(&["github"]), ""), None);
}

#[test]
fn ignores_gh_entries_that_are_not_the_base_or_not_a_remote() {
    assert_eq!(git::choose_pr_remote(&names(&["origin", "upstream"]), "remote.origin.gh-resolved owner/other\n").as_deref(), Some("upstream"));
    assert_eq!(git::choose_pr_remote(&names(&["origin"]), "remote.gone.gh-resolved base\n").as_deref(), Some("origin"));
}

#[test]
fn reads_remotes_and_gh_config_from_the_repo() {
    let repo = Repo::with_commit();
    repo.git(&["remote", "add", "origin", "git@github.com:me/project.git"]);
    assert_eq!(git::pr_remote(&repo.path).unwrap().as_deref(), Some("origin"));
    repo.git(&["remote", "add", "upstream", "git@github.com:org/project.git"]);
    assert_eq!(git::pr_remote(&repo.path).unwrap().as_deref(), Some("upstream"));
    repo.git(&["config", "remote.origin.gh-resolved", "base"]);
    assert_eq!(git::pr_remote(&repo.path).unwrap().as_deref(), Some("origin"));
    let info = git::repo_info(&repo.path).unwrap();
    assert_eq!(info.pr_remote.as_deref(), Some("origin"));
}

#[test]
fn lists_every_remote_url_with_the_pr_remote_first() {
    let repo = Repo::with_commit();
    repo.git(&["remote", "add", "origin", "git@github.com:me/project.git"]);
    repo.git(&["remote", "add", "upstream", "git@github.com:org/project.git"]);
    assert_eq!(git::remote_urls(&repo.path).unwrap(), vec!["git@github.com:org/project.git", "git@github.com:me/project.git"]);
}
